/**
 * upload.spec.ts
 *
 * E2E tests for the PDF upload page:
 *   - Page renders dropzone and "Download sample" button
 *   - Selecting a valid PDF enables the upload button
 *   - Selecting a non-PDF file shows a validation error
 *   - Successful upload redirects / shows success toast
 *   - Remove-file button clears the selection
 */

import path from 'path';
import { test, expect } from './helpers/fixtures';

// A tiny valid-enough PDF for upload testing (1 KB placeholder)
const SAMPLE_PDF_PATH = path.resolve(__dirname, 'fixtures', 'sample.pdf');

test.describe('Upload page', () => {
  test('renders dropzone and download sample button', async ({ uploaderPage: page }) => {
    await page.goto('/upload');

    await expect(page.getByText(/drag & drop your pdf/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /download sample/i })).toBeVisible();
  });

  test('upload button is disabled when no file is selected', async ({ uploaderPage: page }) => {
    await page.goto('/upload');

    const uploadBtn = page.getByRole('button', { name: /upload invoice/i });
    await expect(uploadBtn).toBeDisabled();
  });

  test('selecting a valid PDF enables the upload button', async ({ uploaderPage: page }) => {
    await page.goto('/upload');

    // Use the hidden file input inside the dropzone
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_PDF_PATH);

    // File name should appear
    await expect(page.getByText('sample.pdf')).toBeVisible();

    // Upload button should now be enabled
    const uploadBtn = page.getByRole('button', { name: /upload invoice/i });
    await expect(uploadBtn).toBeEnabled();
  });

  test('selecting a non-PDF file shows a validation error', async ({ uploaderPage: page }) => {
    await page.goto('/upload');

    // Create a fake text file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf'),
    });

    await expect(
      page.getByText(/only pdf files up to 10 mb are accepted/i),
    ).toBeVisible();
  });

  test('remove button clears the file selection', async ({ uploaderPage: page }) => {
    await page.goto('/upload');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_PDF_PATH);
    await expect(page.getByText('sample.pdf')).toBeVisible();

    // Click the X / remove button (aria-label or role button near file name)
    await page.locator('button[class*="rounded-full"]').last().click();

    // Dropzone should reappear
    await expect(page.getByText(/drag & drop your pdf/i)).toBeVisible();
  });

  test('successful upload triggers a redirect or success indicator', async ({
    uploaderPage: page,
  }) => {
    await page.goto('/upload');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_PDF_PATH);

    const uploadBtn = page.getByRole('button', { name: /upload invoice/i });
    await uploadBtn.click();

    // After upload the mutation calls the backend; if successful the
    // page navigates away or shows a success toast.
    // We allow either outcome — a redirect to /invoices or a success message.
    await Promise.race([
      page.waitForURL(/\/invoices/),
      page
        .getByText(/uploaded successfully|invoice uploaded/i)
        .waitFor({ timeout: 15_000 }),
    ]);
  });
});
