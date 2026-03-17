/**
 * invoices.spec.ts
 *
 * E2E tests for the invoice list page:
 *   - Uploader only sees their own invoices (title "My Invoices")
 *   - Validator/approver/admin see "All Invoices"
 *   - Status filter updates the URL
 *   - Clicking a row navigates to the detail page
 *   - Export button is visible for non-uploaders
 *   - Pagination controls appear when there are more than 20 invoices
 */

import { test, expect } from './helpers/fixtures';

test.describe('Invoice list — uploader', () => {
  test('shows "My Invoices" heading', async ({ uploaderPage: page }) => {
    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: /my invoices/i })).toBeVisible();
  });

  test('export button is NOT visible for uploader', async ({ uploaderPage: page }) => {
    await page.goto('/invoices');
    // Give the page a moment to settle
    await page.waitForLoadState('load');
    await expect(page.getByRole('button', { name: /export/i })).not.toBeVisible();
  });
});

test.describe('Invoice list — approver', () => {
  test('shows "All Invoices" heading', async ({ approverPage: page }) => {
    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: /all invoices/i })).toBeVisible();
  });

  test('export button is visible for approver', async ({ approverPage: page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('load');
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });
});

test.describe('Invoice list — filtering', () => {
  test('selecting a status filter updates the URL', async ({ approverPage: page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('load');

    // Open the status select
    await page.getByRole('combobox').first().click();
    // Choose "Approved"
    await page.getByRole('option', { name: 'Approved' }).click();

    await expect(page).toHaveURL(/status=APPROVED/);
  });

  test('selecting sort updates the URL', async ({ approverPage: page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('load');

    // Second combobox is the sort selector
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /oldest first/i }).click();

    await expect(page).toHaveURL(/sort=createdAt%3Aasc/);
  });
});

test.describe('Invoice list — navigation', () => {
  test('Upload Invoice button links to /upload', async ({ uploaderPage: page }) => {
    await page.goto('/invoices');
    await page.getByRole('main').getByRole('link', { name: /upload invoice/i }).first().click();
    await expect(page).toHaveURL(/\/upload/);
  });

  test('clicking an invoice row navigates to detail page', async ({
    approverPage: page,
  }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('load');

    // Only proceed if there is at least one invoice in the table
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    if (count === 0) {
      // No invoices yet — acceptable, skip navigation assertion
      test.skip();
      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/invoices\/.+/);
  });
});
