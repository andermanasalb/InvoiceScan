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

async function buildAuthPage(
  page: Page,
  userKey: keyof typeof PLAYWRIGHT_USERS,
): Promise<Page> {
  // Fresh login per test — each Playwright test gets a fresh browser context,
  // so the previous refresh token (issued in another test's context) has already
  // been rotated by the backend and is no longer valid. Re-logging in guarantees
  // a brand-new refresh token for this context. LOGIN_RATE_LIMIT=100 in CI gives
  // enough headroom for the full test suite.
  const user = PLAYWRIGHT_USERS[userKey];
  const loginResult = await apiLogin(user.email, user.password);
  await setRefreshCookie(page.context(), loginResult.cookie);
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
