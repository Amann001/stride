import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// A free port on this computer.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

// Starts an in-memory Postgres for this test run, creates the tables with the real
// migrations, and tells the tests its address. Everything is thrown away afterwards.
export default async function setup(project: TestProject) {
  const db = await PGlite.create();
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;

  const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  // The real migration script, pointed only at the test database (no .env is read). Run
  // without blocking: the database it talks to lives in this same process.
  await promisify(execFile)(process.execPath, [tsxCli, 'src/migrate.ts'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, JWT_SECRET: 'test-only-secret' },
  });

  project.provide('databaseUrl', databaseUrl);
  return async () => {
    await server.stop();
    await db.close();
  };
}
