import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanTrack, type ActivityType, type TrackPoint } from '@repo/shared';

import { analyseActivity } from './analysis';
import { pool } from './db';

// Runs every .sql file in /migrations that hasn't run yet, in name order.
// Run it with: npm run db:migrate

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Neon's free database may be waking up when the server starts, so the first connection
// can fail. Try a few times before giving up (each migration is all-or-nothing anyway).
async function waitForDatabase() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      console.warn(`Database not ready (attempt ${attempt}), retrying...`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

async function main() {
  await waitForDatabase();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  await backfillAnalysis();
  console.log('Database is up to date.');
}

// Fills in best efforts, top speed and achievements for activities saved before those
// existed. Oldest first, so each one is compared with the ones already filled in.
async function backfillAnalysis() {
  const { rows } = await pool.query<{ id: string; user_id: string; type: ActivityType; points: TrackPoint[]; steps: number | null }>(
    'SELECT id, user_id, type, points, steps FROM activities WHERE best_efforts IS NULL ORDER BY started_at',
  );
  for (const r of rows) {
    const points = cleanTrack(r.points, r.type);
    if (points.length < 2) {
      await pool.query(`UPDATE activities SET best_efforts = '[]' WHERE id = $1`, [r.id]);
      continue;
    }
    const a = await analyseActivity(pool, r.user_id, r.type, points, r.steps);
    await pool.query('UPDATE activities SET max_speed_mps = $2, best_efforts = $3, achievements = $4 WHERE id = $1', [
      r.id,
      a.maxSpeedMps,
      JSON.stringify(a.bestEfforts),
      JSON.stringify(a.achievements),
    ]);
  }
  if (rows.length) console.log(`Analysed ${rows.length} earlier activities.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
