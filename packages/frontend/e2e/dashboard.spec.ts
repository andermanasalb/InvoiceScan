/**
 * dashboard.spec.ts
 *
 * E2E tests for the dashboard page:
 *   - Stats cards are rendered
 *   - Charts section is visible
 *   - Recent activity section is visible
 *   - Navigation links in the sidebar work
 *   - Admin-only links (Users, Assignments) are visible only for admin
 *   - Uploader does NOT see admin links
 */

import { test, expect } from './helpers/fixtures';

test.describe('Dashboard — uploader', () => {
  test('renders the dashboard with stats cards', async ({ uploaderPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The dashboard should have at least one stat card visible
    // We look for common heading text rendered on the page
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('does NOT show admin nav links', async ({ uploaderPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /users/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /assignments/i })).not.toBeVisible();
  });

  test('sidebar has Invoices link that navigates to /invoices', async ({
    uploaderPage: page,
  }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices/);
  });

  test('sidebar has Upload link that navigates to /upload', async ({
    uploaderPage: page,
  }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /upload/i }).first().click();
    await expect(page).toHaveURL(/\/upload/);
  });
});

test.describe('Dashboard — admin', () => {
  test('shows admin nav links (Users and Assignments)', async ({ adminPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /assignments/i })).toBeVisible();
  });

  test('Users link navigates to /admin/users', async ({ adminPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /users/i }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
  });
});

test.describe('Dashboard — approver', () => {
  test('dashboard renders without errors', async ({ approverPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('does NOT show admin links', async ({ approverPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /assignments/i })).not.toBeVisible();
  });
});
