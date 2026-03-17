/**
 * fixtures.ts
 *
 * Playwright fixtures that extend the base `test` with pre-authenticated
 * pages for each role.
 *
 * Usage in specs:
 *
 *   import { test, expect } from './helpers/fixtures';
 *
 *   test('approver can see all invoices', async ({ approverPage }) => {
 *     await approverPage.goto('/invoices');
 *     ...
 *   });
 *
 * Each `*Page` fixture gives you a `Page` that is already logged in as the
 * corresponding role.  The login is done programmatically (API call) so it
 * is fast and does not count as a UI test.
 */

import { test as base, type Page } from '@playwright/test';
import { apiLogin, injectAuth, setRefreshCookie, type LoginResult } from './auth.helper';
import { PLAYWRIGHT_USERS } from './seed.helper';

type AuthFixtures = {
  adminPage: Page;
  approverPage: Page;
  validatorPage: Page;
  uploaderPage: Page;
};

// Backend base URL — the refresh cookie must be registered for the backend
// origin so Chromium sends it when axios POSTs to /auth/refresh.
// SameSite=Lax cookies are NOT reliably sent in cross-port AJAX requests
// (localhost:3001 → localhost:3000) in Chromium; anchoring the cookie to the
// backend origin (localhost:3000) ensures it is treated as same-origin.
const BACKEND_ORIGIN = process.env.BACKEND_URL ?? 'http://localhost:3000';

async function buildAuthPage(
  page: Page,
  userKey: keyof typeof PLAYWRIGHT_USERS,
): Promise<Page> {
  // Fresh login per test — each Playwright test gets a fresh browser context,
  // so the previous refresh token has already been rotated and is no longer
  // valid. Re-logging in gives a brand-new refresh token for this context.
  const user = PLAYWRIGHT_USERS[userKey];
  const loginResult = await apiLogin(user.email, user.password);
  await setRefreshCookie(page.context(), loginResult.cookie, BACKEND_ORIGIN);
  await injectAuth(page, loginResult);
  return page;
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    await buildAuthPage(page, 'admin');
    await use(page);
  },

  approverPage: async ({ page }, use) => {
    await buildAuthPage(page, 'approver');
    await use(page);
  },

  validatorPage: async ({ page }, use) => {
    await buildAuthPage(page, 'validator');
    await use(page);
  },

  uploaderPage: async ({ page }, use) => {
    await buildAuthPage(page, 'uploader');
    await use(page);
  },
});

export { expect } from '@playwright/test';
