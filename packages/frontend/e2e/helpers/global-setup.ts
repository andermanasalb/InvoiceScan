/**
 * global-setup.ts
 *
 * Runs once before all Playwright tests.
 *
 * Responsibilities:
 *   1. Wait for the backend to be healthy.
 *   2. Wait for the frontend to be reachable.
 *   3. Seed Playwright-specific test users via the admin API.
 *
 * Bootstrap strategy (chicken-and-egg fix):
 *   The pw-admin@test.com user does not exist on a fresh DB, so we
 *   cannot log in as them to create everyone else.  Instead we use the
 *   demo admin account that the backend seed always creates on start
 *   (admin@invoicescan.com / Admin1234!) to obtain an admin token, then
 *   create all Playwright-specific users (including pw-admin@test.com).
 *   On subsequent runs the demo admin login succeeds again and the
 *   seedPlaywrightUsers call is a no-op (409 Conflict → skip).
 */

import axios from 'axios';
import { apiLogin } from './auth.helper';
import { seedPlaywrightUsers, seedPlaywrightAssignments } from './seed.helper';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001';
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

/** Demo admin seeded by the backend on every start. */
const DEMO_ADMIN = {
  email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@invoicescan.com',
  password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin1234!',
};

async function waitForUrl(url: string, label: string): Promise<void> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await axios.get(url, { timeout: 3000 });
      console.log(`[global-setup] ${label} is ready`);
      return;
    } catch {
      console.log(
        `[global-setup] Waiting for ${label}... (${i + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error(`[global-setup] ${label} did not become ready at ${url}`);
}

export default async function globalSetup(): Promise<void> {
  // 1. Wait for backend health
  await waitForUrl(`${BACKEND_URL}/api/v1/health`, 'Backend');

  // 2. Wait for frontend
  await waitForUrl(FRONTEND_URL, 'Frontend');

  // 3. Login as the always-present demo admin to get a bootstrap token
  console.log(`[global-setup] Logging in as demo admin (${DEMO_ADMIN.email})`);
  const { accessToken } = await apiLogin(DEMO_ADMIN.email, DEMO_ADMIN.password);

  // 4. Seed all Playwright-specific test users (idempotent — skips 409s)
  await seedPlaywrightUsers(accessToken);

  // 5. Seed assignment chain: uploader → validator → approver (idempotent)
  await seedPlaywrightAssignments(accessToken);

  console.log('[global-setup] Done — Playwright users are ready');
}
