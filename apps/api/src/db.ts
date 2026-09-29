import pg from 'pg';

import { config } from './config';

// A pool keeps a few database connections open and reuses them between requests.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });
