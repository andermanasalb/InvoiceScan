/**
 * seed.helper.ts
 *
 * Creates E2E test users and a generic provider by calling the backend
 * admin API.  Designed to be called from global-setup.ts before any
 * browser test runs.
 *
 * Uses the same credentials as the backend seed-e2e.helper.ts so that
 * tests can reference them from PLAYWRIGHT_USERS without coupling to
 * backend internals.
 */

import axios from 'axios';

// BACKEND_URL should NOT include /api/v1 — this helper appends it.
// Consistent with global-setup.ts and auth.helper.ts conventions.
const BACKEND_BASE = process.env.BACKEND_URL ?? 'http://localhost:3000';
const BACKEND_URL = `${BACKEND_BASE}/api/v1`;

export const PLAYWRIGHT_USERS = {
  admin: {
    email: 'pw-admin@test.com',
    password: 'Admin1234!',
    role: 'admin' as const,
  },
  approver: {
    email: 'pw-approver@test.com',
    password: 'Approver1234!',
    role: 'approver' as const,
  },
  validator: {
    email: 'pw-validator@test.com',
    password: 'Validator1234!',
    role: 'validator' as const,
  },
  uploader: {
    email: 'pw-uploader@test.com',
    password: 'Uploader1234!',
    role: 'uploader' as const,
  },
} as const;

export type PlaywrightUserKey = keyof typeof PLAYWRIGHT_USERS;

/**
 * Seed test users via the admin API.
 * Idempotent: if a user already exists (409) it is silently skipped.
 *
 * Requires an admin access token obtained via direct DB seeding in
 * global-setup or via a bootstrap endpoint.
 */
export async function seedPlaywrightUsers(
  adminToken: string,
): Promise<void> {
  const headers = { Authorization: `Bearer ${adminToken}` };

  for (const user of Object.values(PLAYWRIGHT_USERS)) {
    try {
      await axios.post(
        `${BACKEND_URL}/users`,
        { email: user.email, password: user.password, role: user.role },
        { headers },
      );
    } catch (err) {
      // 409 Conflict → user already exists, skip
      if (axios.isAxiosError(err) && err.response?.status === 409) continue;
      throw err;
    }
  }
}
