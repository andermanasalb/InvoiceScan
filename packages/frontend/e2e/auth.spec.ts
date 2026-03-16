/**
 * auth.spec.ts
 *
 * E2E tests for the authentication flows:
 *   - Valid login redirects to /dashboard
 *   - Invalid credentials show an error
 *   - Unauthenticated users are redirected to /login
 *   - Demo credentials panel fills the form
 *   - Each role lands on /dashboard after login
 *   - Logout clears the session and redirects to /login
 */

import { test, expect } from '@playwright/test';
import { PLAYWRIGHT_USERS } from './helpers/seed.helper';
import { injectAuth, apiLogin, setRefreshCookie } from './helpers/auth.helper';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001';

test.describe('Auth — login page', () => {
  test('shows login form with email, password and submit button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows demo credentials panel when toggled', async ({ page }) => {
    await page.goto('/login');

    // Panel is collapsed by default
    await expect(page.getByText('admin@invoicescan.com')).not.toBeVisible();

    // Open it
    await page.getByText(/demo credentials/i).click();
    await expect(page.getByText('admin@invoicescan.com')).toBeVisible();
    await expect(page.getByText('approver@invoicescan.com')).toBeVisible();
    await expect(page.getByText('validator@invoicescan.com')).toBeVisible();
    await expect(page.getByText('uploader@invoicescan.com')).toBeVisible();
  });

  test('clicking a demo credential fills the form', async ({ page }) => {
    await page.goto('/login');
    await page.getByText(/demo credentials/i).click();

    // Click the "uploader" row
    await page.getByRole('button', { name: /uploader/i }).first().click();

    await expect(page.getByLabel('Email')).toHaveValue('uploader@invoicescan.com');
    await expect(page.getByLabel('Password')).toHaveValue('Uploader1234!');
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nobody@test.com');
    await page.getByLabel('Password').fill('WrongPass99!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('redirects to /dashboard after valid login', async ({ page }) => {
    const user = PLAYWRIGHT_USERS.uploader;

    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Auth — route guard', () => {
  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /invoices redirects to /login', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /upload redirects to /login', async ({ page }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Auth — logout', () => {
  test('logout clears session and redirects to /login', async ({ page }) => {
    // Login programmatically
    const user = PLAYWRIGHT_USERS.uploader;
    const loginResult = await apiLogin(user.email, user.password);
    await setRefreshCookie(page.context(), loginResult.cookie);
    await injectAuth(page, loginResult, '/dashboard');

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Click logout (appears in the sidebar/nav)
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should land on /login
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  });
});

test.describe('Auth — each role lands on dashboard', () => {
  for (const [key, user] of Object.entries(PLAYWRIGHT_USERS)) {
    test(`${key} can log in and reach /dashboard`, async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/dashboard/);
    });
  }
});
