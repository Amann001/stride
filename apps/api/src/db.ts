import pg from 'pg';

import { config } from './config';

// A pool keeps a few database connections open and reuses them between requests.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Neon closes connections that sit unused, so don't keep idle ones around for long.
  idleTimeoutMillis: 30_000,
});

// Neon can close an idle connection at any time (its free plan sleeps). The pool then emits
// 'error'; without this handler Node.js would treat it as unhandled and crash the server.
// The pool simply opens a fresh connection for the next request.
pool.on('error', (err) => {
  console.warn('Database connection closed, a new one will be opened:', err.message);
});
