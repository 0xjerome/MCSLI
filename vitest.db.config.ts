import { defineConfig } from 'vitest/config';

// Integration tests that run the SQL migrations against a real Postgres.
// Requires TEST_DATABASE_URL (see docs/TESTING.md).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
