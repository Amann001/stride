import { defineConfig } from 'vitest/config';

// API tests run against a throwaway Postgres (PGlite) that lives in memory for one test run,
// so they never touch the real database. See test/global-setup.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // One shared database, so test files run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
