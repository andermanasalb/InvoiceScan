/**
 * exports.e2e-spec.ts — Export CSV/JSON E2E tests
 *
 * Tests the async export flow:
 *   POST /api/v1/invoices/export → 202 { jobId }
 *   GET  /api/v1/exports/:jobId/status → polling until 'done'
 *   GET  /api/v1/exports/:jobId/download → file download
 *
 * Prerequisites:
 *   - At least one invoice exists in the DB (created in beforeAll)
 *   - User must have validator, approver, or admin role to export
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createE2EApp, type E2EApp } from './helpers/e2e-app.helper';
import { clearAllTables } from './helpers/db-e2e.helper';
import { seedE2EData, type SeededE2EData } from './helpers/seed-e2e.helper';
import { loginAs } from './helpers/auth-e2e.helper';
import { waitForStatus, waitForExport } from './helpers/wait-for-status.helper';

function makePdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'ascii');
}

describe('Exports E2E', () => {
  let e2e: E2EApp;
  let seed: SeededE2EData;
  let approverToken: string;
  let uploaderToken: string;
  let validatorToken: string;

  beforeAll(async () => {
    e2e = await createE2EApp();
    await clearAllTables(e2e.app);
    seed = await seedE2EData(e2e.app);

    const [ap, up, va] = await Promise.all([
      loginAs(e2e.http, seed.approverCredentials.email, seed.approverCredentials.password),
      loginAs(e2e.http, seed.uploaderCredentials.email, seed.uploaderCredentials.password),
      loginAs(e2e.http, seed.validatorCredentials.email, seed.validatorCredentials.password),
    ]);
    approverToken = ap.accessToken;
    uploaderToken = up.accessToken;
    validatorToken = va.accessToken;

    // Create an invoice and drive it to EXTRACTED so there is data to export
    const uploadRes = await request(e2e.http)
      .post('/api/v1/invoices/upload')
      .set('Authorization', `Bearer ${uploaderToken}`)
      .field('providerId', seed.providerId)
      .attach('file', makePdfBuffer(), { filename: 'export-test.pdf', contentType: 'application/pdf' })
      .expect(201);

    const invoiceId = (uploadRes.body as { data: { invoiceId: string } }).data.invoiceId;
    await waitForStatus(e2e.http, uploaderToken, invoiceId, 'EXTRACTED');
  });

  afterAll(async () => {
    await clearAllTables(e2e.app);
    await e2e.app.close();
  });

  // ─── POST /invoices/export ─────────────────────────────────────────────

  describe('POST /api/v1/invoices/export', () => {
    it('should return 202 with a jobId immediately (async)', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/invoices/export?format=csv')
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(202);

      const jobId = (res.body as { data: { jobId: string } }).data.jobId;
      expect(jobId).toBeTruthy();
      expect(typeof jobId).toBe('string');
    });

    it('should return 403 when an uploader tries to export', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/invoices/export?format=csv')
        .set('Authorization', `Bearer ${uploaderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /exports/:jobId/status + download ────────────────────────────

  describe('CSV export: status polling + download', () => {
    it('should complete and produce a downloadable CSV file', async () => {
      // 1. Enqueue
      const enqueueRes = await request(e2e.http)
        .post('/api/v1/invoices/export?format=csv')
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(202);

      const jobId = (enqueueRes.body as { data: { jobId: string } }).data.jobId;

      // 2. Poll until done
      const statusData = await waitForExport(e2e.http, approverToken, jobId);
      expect(statusData.status).toBe('done');
      expect(statusData.downloadUrl).toBeTruthy();

      // 3. Download
      const downloadRes = await request(e2e.http)
        .get(`/api/v1/exports/${jobId}/download`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(200);

      // CSV must have a header row
      const csvText = downloadRes.text;
      expect(csvText).toContain('invoiceId');
      expect(csvText).toContain('status');
    });
  });

  describe('JSON export: status polling + download', () => {
    it('should complete and produce a valid JSON file', async () => {
      const enqueueRes = await request(e2e.http)
        .post('/api/v1/invoices/export?format=json')
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(202);

      const jobId = (enqueueRes.body as { data: { jobId: string } }).data.jobId;

      await waitForExport(e2e.http, approverToken, jobId);

      const downloadRes = await request(e2e.http)
        .get(`/api/v1/exports/${jobId}/download`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(200);

      // Must be valid JSON
      expect(() => JSON.parse(downloadRes.text)).not.toThrow();
      const parsed = JSON.parse(downloadRes.text) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('Export status for a non-existent jobId', () => {
    it('should return 404', async () => {
      const res = await request(e2e.http)
        .get('/api/v1/exports/non-existent-job-id/status')
        .set('Authorization', `Bearer ${validatorToken}`);

      expect(res.status).toBe(404);
    });
  });
});
