import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
} from '../invoices.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal valid PDF buffer — just the magic bytes that file-type
 * needs to identify the format as application/pdf.
 */
function makePdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4 minimal test invoice', 'ascii');
}

// ---------------------------------------------------------------------------
// Test module setup
// ---------------------------------------------------------------------------

/**
 * We test the controller in isolation:
 *
 * - The use case is replaced with a vi.fn() mock so tests control its output
 *   without needing a database or a real storage adapter.
 * - NestJS still wires up the full HTTP pipeline (interceptors, pipes, guards)
 *   so we're testing the real controller behaviour, not a stripped-down stub.
 * - Supertest sends actual HTTP requests to the in-memory NestJS server.
 */
describe('InvoicesController (e2e)', () => {
  let app: INestApplication;

  // Shared mock — each test can override its resolved value
  const mockUploadUseCase = { execute: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: UPLOAD_INVOICE_USE_CASE_TOKEN,
          useValue: mockUploadUseCase,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- happy path ---

  describe('POST /api/v1/invoices/upload', () => {
    it('should return 201 and the invoice data when a valid PDF is uploaded', async () => {
      const fakeOutput = {
        invoiceId: 'inv-uuid-123',
        status: 'PENDING',
        filePath: 'some-uuid.pdf',
        uploaderId: '00000000-0000-0000-0000-000000000001',
        providerId: '00000000-0000-0000-0000-000000000002',
        createdAt: new Date().toISOString(),
      };

      // ok() from neverthrow — simulate a successful use case result
      mockUploadUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeOutput,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .attach('file', makePdfBuffer(), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invoiceId).toBe('inv-uuid-123');
      expect(response.body.data.status).toBe('PENDING');
    });

    // --- missing file ---

    it('should return 400 when no file is provided', async () => {
      const response = await request(app.getHttpServer()).post(
        '/api/v1/invoices/upload',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No file uploaded/);
    });

    // --- file too large ---

    it('should return 400 when the file exceeds 10 MB', async () => {
      // Build a buffer that starts with PDF magic bytes then is padded to 11 MB
      const oversized = Buffer.alloc(11 * 1024 * 1024);
      Buffer.from('%PDF-1.4 ', 'ascii').copy(oversized);

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .attach('file', oversized, {
          filename: 'big.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/maximum allowed size/);
    });

    // --- wrong MIME type ---

    it('should return 400 when the file is not a real PDF', async () => {
      // PNG magic bytes (full IHDR so file-type can detect it)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .attach('file', pngBuffer, {
          filename: 'sneaky.pdf',       // extension says PDF...
          contentType: 'application/pdf', // header says PDF...
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid file type/);
    });
  });
});
