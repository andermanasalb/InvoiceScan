import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { join } from 'path';

/**
 * Vitest config for E2E tests.
 *
 * Key differences:
 * - fileParallelism: false  → suites run sequentially (shared DB state)
 * - testTimeout: 30_000     → BullMQ workers need time to process jobs
 * - globalSetup             → runs TypeORM migrations once before all suites
 * - include                 → only *.e2e-spec.ts files in test/
 *
 * Usage:
 *   pnpm --filter backend test:e2e
 *
 * Prerequisites:
 *   PostgreSQL and Redis must be running (docker compose up -d).
 *   DATABASE_URL and REDIS_URL must be set in .env at the monorepo root.
 */
export default defineConfig({
  test: {
    globals: true,
    root: join(__dirname, '..'),
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['test/setup/global-setup.ts'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
