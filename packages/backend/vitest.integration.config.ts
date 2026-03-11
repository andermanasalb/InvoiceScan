import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config for INTEGRATION tests only.
 *
 * Key differences from the default config:
 * - fileParallelism: false  → test files run sequentially (no concurrent DB writes)
 * - testTimeout: 30000      → DB operations can be slow, give them 30s
 * - include: only *.integration-spec.ts files
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration-spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
