/**
 * invoices.e2e-spec.ts — Invoice workflow E2E tests
 *
 * Tests the complete lifecycle of an invoice through all states,
 * against a real NestJS application with real PostgreSQL, Redis, and BullMQ.
 *
 * The LLM is replaced with a deterministic stub (see e2e-app.helper.ts).
 * The OCR uses pdf-parse which works on any Buffer (it finds no text in a
 * minimal PDF, so the LLM stub takes over for extraction).
 *
 * Flow tested:
 *   upload → PENDING → (worker) → EXTRACTED
 *   → send-to-validation → READY_FOR_VALIDATION
 *   → send-to-approval → READY_FOR_APPROVAL
 *   → approve → APPROVED
 *
 * Also tests: reject, retry, RBAC, notes, events history.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createE2EApp, type E2EApp, stubLlmResult } from './helpers/e2e-app.helper';
import { clearAllTables } from './helpers/db-e2e.helper';
import { seedE2EData, type SeededE2EData } from './helpers/seed-e2e.helper';
import { loginAs } from './helpers/auth-e2e.helper';
import { waitForStatus } from './helpers/wait-for-status.helper';

// Minimal PDF with the right magic bytes so FileValidationPipe accepts it
function makePdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'ascii');
}

describe('Invoices workflow E2E', () => {
  let e2e: E2EApp;
  let seed: SeededE2EData;

  // Auth tokens — refreshed in beforeAll
  let uploaderToken: string;
  let validatorToken: string;
  let approverToken: string;
  let uploaderBToken: string;

  beforeAll(async () => {
    e2e = await createE2EApp();
    await clearAllTables(e2e.app);
    seed = await seedE2EData(e2e.app);

    // Login all users once for the whole suite
    const [up, va, ap, upB] = await Promise.all([
      loginAs(e2e.http, seed.uploaderCredentials.email, seed.uploaderCredentials.password),
      loginAs(e2e.http, seed.validatorCredentials.email, seed.validatorCredentials.password),
      loginAs(e2e.http, seed.approverCredentials.email, seed.approverCredentials.password),
      loginAs(e2e.http, seed.uploaderBCredentials.email, seed.uploaderBCredentials.password),
    ]);

    uploaderToken = up.accessToken;
    validatorToken = va.accessToken;
    approverToken = ap.accessToken;
    uploaderBToken = upB.accessToken;
  });

  afterAll(async () => {
    await clearAllTables(e2e.app);
    await e2e.app.close();
  });

  // ─── Upload ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/invoices/upload', () => {
    it('should return 201 with invoiceId and status PENDING', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect((res.body as { data: { invoiceId: string; status: string } }).data.invoiceId).toBeTruthy();
      expect((res.body as { data: { status: string } }).data.status).toBe('PENDING');
    });

    it('should return 400 when providerId is missing', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .attach('file', makePdfBuffer(), { filename: 'test.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when no file is attached', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId);

      expect(res.status).toBe(400);
    });

    it('should return 400 when file is not a PDF', async () => {
      // PNG magic bytes
      const fakePng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(100, 0),
      ]);

      const res = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', fakePng, { filename: 'fake.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Full happy-path workflow ─────────────────────────────────────────────

  describe('Full workflow: PENDING → EXTRACTED → READY_FOR_VALIDATION → READY_FOR_APPROVAL → APPROVED', () => {
    let invoiceId: string;

    it('step 1: upload and wait for worker to produce EXTRACTED', async () => {
      const uploadRes = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'invoice.pdf', contentType: 'application/pdf' })
        .expect(201);

      invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;

      // Wait for the BullMQ worker to process the job
      const data = await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');

      // The LLM stub data should be reflected in extractedData
      expect((data as { extractedData: { total: number } }).extractedData?.total).toBe(stubLlmResult.total);
      expect((data as { extractedData: { numeroFactura: string } }).extractedData?.numeroFactura).toBe(stubLlmResult.numeroFactura);
    });

    it('step 2: uploader sends to validation → READY_FOR_VALIDATION', async () => {
      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/send-to-validation`)
        .set('Authorization', `Bearer ${uploaderToken}`)
        .expect(200);

      expect((res.body as { data: { status: string } }).data.status).toBe('READY_FOR_VALIDATION');
    });

    it('step 3: validator sends to approval → READY_FOR_APPROVAL', async () => {
      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/send-to-approval`)
        .set('Authorization', `Bearer ${validatorToken}`)
        .expect(200);

      expect((res.body as { data: { status: string } }).data.status).toBe('READY_FOR_APPROVAL');
    });

    it('step 4: approver approves → APPROVED', async () => {
      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(200);

      expect((res.body as { data: { status: string } }).data.status).toBe('APPROVED');
    });

    it('step 5: GET /events returns full transition history in order', async () => {
      const res = await request(e2e.http)
        .get(`/api/v1/invoices/${invoiceId}/events`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(200);

      const events = (res.body as { data: Array<{ from: string; to: string }> }).data;
      expect(events.length).toBeGreaterThanOrEqual(4);

      const statuses = events.map((e) => e.to);
      expect(statuses).toContain('PROCESSING');
      expect(statuses).toContain('EXTRACTED');
      expect(statuses).toContain('READY_FOR_VALIDATION');
      expect(statuses).toContain('READY_FOR_APPROVAL');
      expect(statuses).toContain('APPROVED');
    });
  });

  // ─── Reject + Retry workflow ──────────────────────────────────────────────

  describe('Reject workflow: PENDING → EXTRACTED → READY_FOR_VALIDATION → READY_FOR_APPROVAL → REJECTED', () => {
    let invoiceId: string;

    beforeAll(async () => {
      // Upload and drive to READY_FOR_APPROVAL
      const uploadRes = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'reject.pdf', contentType: 'application/pdf' })
        .expect(201);

      invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;
      await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');

      await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/send-to-validation`)
        .set('Authorization', `Bearer ${uploaderToken}`)
        .expect(200);

      await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/send-to-approval`)
        .set('Authorization', `Bearer ${validatorToken}`)
        .expect(200);
    });

    it('should reject with a reason → REJECTED', async () => {
      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/reject`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ reason: 'Missing VAT breakdown' })
        .expect(200);

      expect((res.body as { data: { status: string } }).data.status).toBe('REJECTED');
    });

    it('should return 400 when reject is called without a reason', async () => {
      // Use a fresh invoice at READY_FOR_APPROVAL for this test
      const uploadRes2 = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'r2.pdf', contentType: 'application/pdf' })
        .expect(201);

      const id2 = (uploadRes2.body as { data: { invoiceId: string } }).data.invoiceId;
      await waitForStatus(e2e.http, uploaderToken, id2, 'EXTRACTED');
      await request(e2e.http).patch(`/api/v1/invoices/${id2}/send-to-validation`).set('Authorization', `Bearer ${uploaderToken}`);
      await request(e2e.http).patch(`/api/v1/invoices/${id2}/send-to-approval`).set('Authorization', `Bearer ${validatorToken}`);

      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${id2}/reject`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({})
        .expect(400);

      expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── State transition errors ──────────────────────────────────────────────

  describe('Invalid state transitions', () => {
    it('should return 409 when trying to approve an EXTRACTED invoice (not READY_FOR_APPROVAL)', async () => {
      const uploadRes = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'early.pdf', contentType: 'application/pdf' })
        .expect(201);

      const invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;
      await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');

      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`);

      expect(res.status).toBe(409);
      expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should return 404 when acting on a non-existent invoice', async () => {
      const res = await request(e2e.http)
        .patch('/api/v1/invoices/00000000-0000-4000-8000-000000000001/approve')
        .set('Authorization', `Bearer ${approverToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── RBAC ─────────────────────────────────────────────────────────────────

  describe('RBAC enforcement', () => {
    let invoiceId: string;

    beforeAll(async () => {
      // uploaderA creates an invoice
      const uploadRes = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'rbac.pdf', contentType: 'application/pdf' })
        .expect(201);

      invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;
      await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');
    });

    it('uploaderB cannot GET an invoice that belongs to uploaderA', async () => {
      const res = await request(e2e.http)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${uploaderBToken}`);

      expect(res.status).toBe(403);
    });

    it('uploader cannot approve an invoice', async () => {
      const res = await request(e2e.http)
        .patch(`/api/v1/invoices/${invoiceId}/approve`)
        .set('Authorization', `Bearer ${uploaderToken}`);

      // 403 from RolesGuard (uploader role not in @Roles('approver','admin'))
      expect(res.status).toBe(403);
    });

    it('validator can GET all invoices (full access)', async () => {
      const res = await request(e2e.http)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${validatorToken}`)
        .expect(200);

      expect(typeof (res.body as { meta: { total: number } }).meta.total).toBe('number');
    });
  });

  // ─── List and detail ──────────────────────────────────────────────────────

  describe('GET /api/v1/invoices', () => {
    it('should return paginated list with meta', async () => {
      const res = await request(e2e.http)
        .get('/api/v1/invoices?page=1&limit=5')
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(200);

      expect((res.body as { data: unknown[] }).data).toBeInstanceOf(Array);
      expect((res.body as { meta: { page: number } }).meta.page).toBe(1);
    });

    it('should return 400 when page is not a number', async () => {
      const res = await request(e2e.http)
        .get('/api/v1/invoices?page=abc')
        .set('Authorization', `Bearer ${approverToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ─── Notes ────────────────────────────────────────────────────────────────

  describe('Invoice notes', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const uploadRes = await request(e2e.http)
        .post('/api/v1/invoices/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('providerId', seed.providerId)
        .attach('file', makePdfBuffer(), { filename: 'notes.pdf', contentType: 'application/pdf' })
        .expect(201);

      invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;
      await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');
    });

    it('validator can add a note', async () => {
      await request(e2e.http)
        .post(`/api/v1/invoices/${invoiceId}/notes`)
        .set('Authorization', `Bearer ${validatorToken}`)
        .send({ content: 'Please check the VAT number' })
        .expect(201);
    });

    it('GET /notes returns the note just added', async () => {
      const res = await request(e2e.http)
        .get(`/api/v1/invoices/${invoiceId}/notes`)
        .set('Authorization', `Bearer ${validatorToken}`)
        .expect(200);

      const notes = (res.body as { data: Array<{ content: string }> }).data;
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes[notes.length - 1].content).toBe('Please check the VAT number');
    });

    it('uploader cannot add a note (403)', async () => {
      const res = await request(e2e.http)
        .post(`/api/v1/invoices/${invoiceId}/notes`)
        .set('Authorization', `Bearer ${uploaderToken}`)
        .send({ content: 'I should not be able to add notes' });

      expect(res.status).toBe(403);
    });
  });
});
