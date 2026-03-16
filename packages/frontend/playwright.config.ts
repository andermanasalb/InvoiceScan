/**
 * playwright.config.ts
 *
 * Configuration for Playwright E2E UI tests.
 *
 * Prerequisites before running:
 *   - Backend running on http://localhost:3000
 *   - Frontend running on http://localhost:3001
 *   - PostgreSQL + Redis running (see docker-compose.yml)
 *   - Seed data created (via globalSetup or manually)
 *
 * Run:
 *   pnpm --filter frontend test:e2e
 *   pnpm --filter frontend test:e2e:headed   (with browser visible)
 *   pnpm --filter frontend test:e2e:ui       (interactive Playwright UI)
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — shared DB state between tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker — avoids DB race conditions
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],

  globalSetup: './e2e/helpers/global-setup.ts',

  use: {
    baseURL: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // All API calls go to the backend
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Output dir for test artifacts (screenshots, videos, traces)
  outputDir: './playwright-results',
});
