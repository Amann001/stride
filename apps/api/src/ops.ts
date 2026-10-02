import { pool } from './db';

// Owner's dashboard in the terminal. Run from the project folder:
//   npm run ops                       open reports and the last week's errors
//   npm run ops -- reviewed <id>      mark a report as looked at (no action needed)
//   npm run ops -- actioned <id>      mark a report as dealt with (e.g. you removed content)

async function listReports() {
  const { rows } = await pool.query<{
    id: string; created_at: Date; reason: string; details: string | null;
    reporter: string | null; target: string | null; target_id: string | null;
    activity_title: string | null; comment: string | null; message: string | null;
  }>(
    `SELECT r.id, r.created_at, r.reason, r.details,
       rep.name AS reporter, tgt.name AS target, r.target_user_id AS target_id,
       a.title AS activity_title, c.body AS comment, m.body AS message
     FROM reports r
     LEFT JOIN users rep ON rep.id = r.reporter_id
     LEFT JOIN users tgt ON tgt.id = r.target_user_id
     LEFT JOIN activities a ON a.id = r.activity_id
     LEFT JOIN comments c ON c.id = r.comment_id
     LEFT JOIN messages m ON m.id = r.message_id
     WHERE r.status = 'open' ORDER BY r.created_at`,
  );
  console.log(`\n=== Open reports: ${rows.length} ===`);
  for (const r of rows) {
    console.log(`\n[${r.id}] ${r.created_at.toISOString().slice(0, 16)}  reason: ${r.reason}`);
    console.log(`  ${r.reporter ?? '(deleted account)'} reported ${r.target ?? '(deleted account)'} (user ${r.target_id ?? '-'})`);
    if (r.activity_title) console.log(`  activity: "${r.activity_title}"`);
    if (r.comment) console.log(`  comment: "${r.comment}"`);
    if (r.message) console.log(`  message: "${r.message}"`);
    if (r.details) console.log(`  details: ${r.details}`);
  }
}

async function listErrors() {
  const { rows } = await pool.query<{ source: string; message: string; n: number; last: Date }>(
    `SELECT source, message, count(*)::int AS n, max(created_at) AS last
     FROM error_reports WHERE created_at > now() - interval '7 days'
     GROUP BY source, message ORDER BY last DESC LIMIT 30`,
  );
  console.log(`\n=== Errors in the last 7 days: ${rows.reduce((s, r) => s + r.n, 0)} ===`);
  for (const r of rows) {
    console.log(`  ${r.last.toISOString().slice(0, 16)}  ${r.source.padEnd(6)} x${r.n}  ${r.message.slice(0, 140)}`);
  }
  // Keep the table small: errors older than 90 days aren't useful.
  await pool.query("DELETE FROM error_reports WHERE created_at < now() - interval '90 days'");
}

async function main() {
  const [command, id] = process.argv.slice(2);
  if (command === 'reviewed' || command === 'actioned') {
    if (!id) throw new Error(`Usage: npm run ops -- ${command} <report id>`);
    const { rowCount } = await pool.query('UPDATE reports SET status = $2 WHERE id = $1', [id, command]);
    console.log(rowCount ? `Report ${id} marked ${command}.` : `No report with id ${id}.`);
    return;
  }
  await listReports();
  await listErrors();
  console.log('\nTo hide someone everywhere, block them from your own account; to remove an account,');
  console.log('delete the user row in the Neon console (everything they posted goes with it).');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
