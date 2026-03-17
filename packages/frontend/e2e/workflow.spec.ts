/**
 * workflow.spec.ts
 *
 * E2E tests for the invoice workflow:
 *
 *   upload (uploader) → PENDING → PROCESSING → EXTRACTED
 *     → Send to Validation (uploader)
 *       → READY_FOR_VALIDATION
 *         → Send to Approval (approver)
 *           → READY_FOR_APPROVAL
 *             → Approve / Reject (approver)
 *
 * These tests are integration-heavy: they upload a real PDF via the
 * API, poll for status transitions, and then drive the UI through
 * each manual transition.
 *
 * Each test is self-contained:
 *   1. Create an invoice via API (uploader token).
 *   2. Poll backend until it reaches the expected status.
 *   3. Use the corresponding role's page to perform the UI action.
 *   4. Assert the new status is visible in the detail page.
 */

import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { test, expect } from './helpers/fixtures';
import { apiLogin } from './helpers/auth.helper';
import { PLAYWRIGHT_USERS } from './helpers/seed.helper';

const BACKEND_URL = `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/api/v1`;
const SAMPLE_PDF = path.resolve(__dirname, 'fixtures', 'sample.pdf');

// ---------- helpers ---------------------------------------------------------

async function getToken(role: keyof typeof PLAYWRIGHT_USERS): Promise<string> {
  const u = PLAYWRIGHT_USERS[role];
  const r = await apiLogin(u.email, u.password);
  return r.accessToken;
}

async function uploadInvoice(token: string): Promise<string> {
  const form = new FormData();
  const pdfBuffer = fs.readFileSync(SAMPLE_PDF);
  form.append(
    'file',
    new Blob([pdfBuffer], { type: 'application/pdf' }),
    'sample.pdf',
  );
  // Use the generic provider id defined in shared/constants
  form.append(
    'providerId',
    process.env.GENERIC_PROVIDER_ID ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  );

  const res = await axios.post(`${BACKEND_URL}/invoices/upload`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return (res.data as { data: { invoiceId: string } }).data.invoiceId;
}

async function pollStatus(
  invoiceId: string,
  token: string,
  expectedStatus: string,
  maxWait = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await axios.get(`${BACKEND_URL}/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const status = (res.data as { data: { status: string } }).data.status;
    if (status === expectedStatus) return;
    if (['APPROVED', 'REJECTED', 'VALIDATION_FAILED'].includes(status) && status !== expectedStatus) {
      throw new Error(`Invoice reached terminal status ${status}, expected ${expectedStatus}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Invoice did not reach ${expectedStatus} within ${maxWait}ms`);
}

// ---------- tests -----------------------------------------------------------

test.describe('Workflow — send to validation', () => {
  test('uploader can send an EXTRACTED invoice to validation', async ({
    uploaderPage: page,
  }) => {
    const token = await getToken('uploader');
    const invoiceId = await uploadInvoice(token);

    // Wait for OCR worker to finish
    await pollStatus(invoiceId, token, 'EXTRACTED');

    // Navigate to detail page
    await page.goto(`/invoices/${invoiceId}`);

    // "Send to Validation" button should be visible
    const sendBtn = page.getByRole('button', { name: /send to validation/i });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // Status badge should update to READY_FOR_VALIDATION
    await expect(
      page.getByText(/needs validation|ready.for.validation/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Workflow — send to approval', () => {
  test('approver can send a READY_FOR_VALIDATION invoice to approval', async ({
    approverPage: page,
  }) => {
    // Upload as uploader, send to validation via API, then drive UI as approver
    const uploaderToken = await getToken('uploader');
    const approverToken = await getToken('approver');
    const invoiceId = await uploadInvoice(uploaderToken);

    await pollStatus(invoiceId, uploaderToken, 'EXTRACTED');

    // Send to validation via API (uploader action)
    await axios.patch(
      `${BACKEND_URL}/invoices/${invoiceId}/send-to-validation`,
      {},
      { headers: { Authorization: `Bearer ${uploaderToken}` } },
    );

    await pollStatus(invoiceId, approverToken, 'READY_FOR_VALIDATION');

    // Navigate to detail as approver
    await page.goto(`/invoices/${invoiceId}`);

    const sendBtn = page.getByRole('button', { name: /send to approval/i });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // Modal may appear — confirm if present
    const confirmBtn = page.getByRole('button', { name: /send to approval/i }).last();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await expect(
      page.getByText(/ready.for.approval/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Workflow — approve', () => {
  test('approver can approve a READY_FOR_APPROVAL invoice', async ({
    approverPage: page,
  }) => {
    const uploaderToken = await getToken('uploader');
    const approverToken = await getToken('approver');
    const invoiceId = await uploadInvoice(uploaderToken);

    await pollStatus(invoiceId, uploaderToken, 'EXTRACTED');

    // Move through states via API
    await axios.patch(
      `${BACKEND_URL}/invoices/${invoiceId}/send-to-validation`,
      {},
      { headers: { Authorization: `Bearer ${uploaderToken}` } },
    );
    await pollStatus(invoiceId, approverToken, 'READY_FOR_VALIDATION');

    await axios.patch(
      `${BACKEND_URL}/invoices/${invoiceId}/send-to-approval`,
      {},
      { headers: { Authorization: `Bearer ${approverToken}` } },
    );
    await pollStatus(invoiceId, approverToken, 'READY_FOR_APPROVAL');

    // Drive approval in UI
    await page.goto(`/invoices/${invoiceId}`);

    const approveBtn = page.getByRole('button', { name: /^approve$/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Confirmation dialog
    const confirmBtn = page.getByRole('button', { name: /confirm|approve/i }).last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Workflow — reject', () => {
  test('approver can reject a READY_FOR_APPROVAL invoice', async ({
    approverPage: page,
  }) => {
    const uploaderToken = await getToken('uploader');
    const approverToken = await getToken('approver');
    const invoiceId = await uploadInvoice(uploaderToken);

    await pollStatus(invoiceId, uploaderToken, 'EXTRACTED');

    await axios.patch(
      `${BACKEND_URL}/invoices/${invoiceId}/send-to-validation`,
      {},
      { headers: { Authorization: `Bearer ${uploaderToken}` } },
    );
    await pollStatus(invoiceId, approverToken, 'READY_FOR_VALIDATION');

    await axios.patch(
      `${BACKEND_URL}/invoices/${invoiceId}/send-to-approval`,
      {},
      { headers: { Authorization: `Bearer ${approverToken}` } },
    );
    await pollStatus(invoiceId, approverToken, 'READY_FOR_APPROVAL');

    await page.goto(`/invoices/${invoiceId}`);

    const rejectBtn = page.getByRole('button', { name: /^reject$/i });
    await expect(rejectBtn).toBeVisible();
    await rejectBtn.click();

    // Rejection modal — fill in reason
    const reasonInput = page.getByPlaceholder(/reason|why/i);
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill('Duplicate invoice — already processed');

    await page.getByRole('button', { name: /confirm|reject/i }).last().click();

    await expect(page.getByText(/rejected/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
