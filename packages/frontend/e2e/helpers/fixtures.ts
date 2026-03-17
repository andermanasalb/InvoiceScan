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

// Module-level cache — persists for the lifetime of the worker process.
// Since Playwright runs with workers: 1, each role is logged in at most once
// per test run, avoiding repeated logins that exhaust the rate limit.
const _loginCache = new Map<string, LoginResult>();

async function getCachedLogin(
  userKey: keyof typeof PLAYWRIGHT_USERS,
): Promise<LoginResult> {
  if (!_loginCache.has(userKey)) {
    const user = PLAYWRIGHT_USERS[userKey];
    _loginCache.set(userKey, await apiLogin(user.email, user.password));
  }
  return _loginCache.get(userKey)!;
}

async function buildAuthPage(
  page: Page,
  userKey: keyof typeof PLAYWRIGHT_USERS,
): Promise<Page> {
  const loginResult = await getCachedLogin(userKey);
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
