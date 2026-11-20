import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
// @if db
    // Tests share one PostgreSQL test database: run files one at a time.
    globalSetup: ['./src/server/test/global-setup.ts'],
    fileParallelism: false,
// @endif
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
