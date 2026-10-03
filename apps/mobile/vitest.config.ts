import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Tests for the app's plain logic (no screens): the offline upload outbox and stat helpers.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['test/**/*.test.ts'] },
});
