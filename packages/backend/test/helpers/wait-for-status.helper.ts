/**
 * wait-for-status.helper.ts
 *
 * Polls GET /api/v1/invoices/:id until the invoice reaches the expected status
 * or the timeout expires.
 *
 * The BullMQ worker that processes invoices is asynchronous — the HTTP response
 * to POST /upload returns immediately with status PENDING.  Tests must wait
 * for the worker to run before asserting on the extracted data.
 *
 * Usage:
 *   const invoice = await waitForStatus(http, token, invoiceId, 'EXTRACTED');
 */

import request from 'supertest';

const POLL_INTERVAL_MS = 500;

export async function waitForStatus(
  http: ReturnType<import('@nestjs/common').INestApplication['getHttpServer']>,
  accessToken: string,
  invoiceId: string,
  expectedStatus: string,
  maxWaitMs = 15_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await request(http)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    if (res.status === 200) {
      const data = (res.body as { data: { status: string } }).data;
      if (data.status === expectedStatus) {
        return data as Record<string, unknown>;
      }
      // If status is a terminal failure state and we're waiting for something
      // else, bail early to avoid waiting the full timeout
      if (
        ['REJECTED', 'VALIDATION_FAILED'].includes(data.status) &&
        data.status !== expectedStatus
      ) {
        throw new Error(
          `Invoice reached terminal status '${data.status}' while waiting for '${expectedStatus}'`,
        );
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Invoice ${invoiceId} did not reach status '${expectedStatus}' within ${maxWaitMs}ms`,
  );
}

/**
 * Polls GET /api/v1/exports/:jobId/status until status = 'done' or 'failed'.
 */
export async function waitForExport(
  http: ReturnType<import('@nestjs/common').INestApplication['getHttpServer']>,
  accessToken: string,
  jobId: string,
  maxWaitMs = 15_000,
): Promise<{ status: string; downloadUrl?: string }> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await request(http)
      .get(`/api/v1/exports/${jobId}/status`)
      .set('Authorization', `Bearer ${accessToken}`);

    if (res.status === 200) {
      const data = (res.body as { data: { status: string; downloadUrl?: string } }).data;
      if (data.status === 'done' || data.status === 'failed') {
        return data;
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Export job ${jobId} did not complete within ${maxWaitMs}ms`);
}
