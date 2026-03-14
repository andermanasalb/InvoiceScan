import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
  LIST_INVOICES_USE_CASE_TOKEN,
  GET_INVOICE_USE_CASE_TOKEN,
  APPROVE_INVOICE_USE_CASE_TOKEN,
  REJECT_INVOICE_USE_CASE_TOKEN,
  GET_INVOICE_EVENTS_USE_CASE_TOKEN,
  SEND_TO_APPROVAL_USE_CASE_TOKEN,
  SEND_TO_VALIDATION_USE_CASE_TOKEN,
  RETRY_INVOICE_USE_CASE_TOKEN,
  ADD_NOTE_USE_CASE_TOKEN,
  GET_INVOICE_NOTES_USE_CASE_TOKEN,
} from '../invoices.controller';
import { InvoiceNotFoundError } from '../../../../domain/errors/invoice.errors.js';
import { InvalidStateTransitionError } from '../../../../domain/errors/invoice.errors.js';
import type { AuthenticatedUser } from '../../guards/jwt.strategy';

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

/** Fake user injected by the mock guard into every request. */
const FAKE_USER: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  role: 'uploader',
};

/** Fake approver — can approve/reject invoices. */
const FAKE_APPROVER: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000099',
  role: 'approver',
};

/** Fake validator user — can see all invoices. */
const FAKE_VALIDATOR: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000088',
  role: 'validator',
};

// ---------------------------------------------------------------------------
// Test module setup
// ---------------------------------------------------------------------------

/**
 * We test the controller in isolation:
 *
 * - Each use case is replaced with a vi.fn() mock so tests control its output
 *   without needing a database or a real storage adapter.
 * - JwtAuthGuard is replaced with a mock that always passes and injects a
 *   fake AuthenticatedUser, so we don't need a real JWT or Passport setup.
 * - NestJS still wires up the full HTTP pipeline (interceptors, pipes, guards)
 *   so we're testing the real controller behaviour, not a stripped-down stub.
 * - Supertest sends actual HTTP requests to the in-memory NestJS server.
 */
describe('InvoicesController (e2e)', () => {
  let app: INestApplication;
  let currentUser: AuthenticatedUser = FAKE_USER;

  // Shared mocks — each test can override their resolved value
  const mockUploadUseCase = { execute: vi.fn() };
  const mockListUseCase = { execute: vi.fn() };
  const mockGetUseCase = { execute: vi.fn() };
  const mockApproveUseCase = { execute: vi.fn() };
  const mockRejectUseCase = { execute: vi.fn() };
  const mockGetEventsUseCase = { execute: vi.fn() };
  const mockSendToApprovalUseCase = { execute: vi.fn() };
  const mockSendToValidationUseCase = { execute: vi.fn() };
  const mockRetryUseCase = { execute: vi.fn() };
  const mockAddNoteUseCase = { execute: vi.fn() };
  const mockGetNotesUseCase = { execute: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: UPLOAD_INVOICE_USE_CASE_TOKEN,
          useValue: mockUploadUseCase,
        },
        {
          provide: LIST_INVOICES_USE_CASE_TOKEN,
          useValue: mockListUseCase,
        },
        {
          provide: GET_INVOICE_USE_CASE_TOKEN,
          useValue: mockGetUseCase,
        },
        {
          provide: APPROVE_INVOICE_USE_CASE_TOKEN,
          useValue: mockApproveUseCase,
        },
        {
          provide: REJECT_INVOICE_USE_CASE_TOKEN,
          useValue: mockRejectUseCase,
        },
        {
          provide: GET_INVOICE_EVENTS_USE_CASE_TOKEN,
          useValue: mockGetEventsUseCase,
        },
        {
          provide: SEND_TO_APPROVAL_USE_CASE_TOKEN,
          useValue: mockSendToApprovalUseCase,
        },
        {
          provide: SEND_TO_VALIDATION_USE_CASE_TOKEN,
          useValue: mockSendToValidationUseCase,
        },
        {
          provide: RETRY_INVOICE_USE_CASE_TOKEN,
          useValue: mockRetryUseCase,
        },
        {
          provide: ADD_NOTE_USE_CASE_TOKEN,
          useValue: mockAddNoteUseCase,
        },
        {
          provide: GET_INVOICE_NOTES_USE_CASE_TOKEN,
          useValue: mockGetNotesUseCase,
        },
        // Register the mock JWT guard globally (mirrors app.module.ts APP_GUARD),
        // so it runs for ALL routes and populates req.user for @CurrentUser().
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              const req = ctx
                .switchToHttp()
                .getRequest<{ user: AuthenticatedUser }>();
              req.user = currentUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- POST /upload ---

  // Must be a valid RFC 4122 UUID (Zod v4 enforces version + variant bits)
  const VALID_PROVIDER_ID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';

  describe('POST /api/v1/invoices/upload', () => {
    beforeAll(() => {
      currentUser = FAKE_USER;
    });

    it('should return 201 and the invoice data when a valid PDF and providerId are sent', async () => {
      const fakeOutput = {
        invoiceId: 'inv-uuid-123',
        status: 'PENDING',
        filePath: 'some-uuid.pdf',
        uploaderId: FAKE_USER.userId,
        providerId: VALID_PROVIDER_ID,
        createdAt: new Date().toISOString(),
      };

      mockUploadUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeOutput,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', VALID_PROVIDER_ID)
        .attach('file', makePdfBuffer(), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invoiceId).toBe('inv-uuid-123');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should forward the userId from the JWT and the providerId from the body to the use case', async () => {
      mockUploadUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { invoiceId: 'inv-x', status: 'PENDING' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', VALID_PROVIDER_ID)
        .attach('file', makePdfBuffer(), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      const callArg = mockUploadUseCase.execute.mock.calls.at(-1)?.[0] as {
        uploaderId: string;
        providerId: string;
      };
      expect(callArg.uploaderId).toBe(FAKE_USER.userId);
      expect(callArg.providerId).toBe(VALID_PROVIDER_ID);
    });

    it('should return 400 when providerId is missing from the body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .attach('file', makePdfBuffer(), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when providerId is not a valid UUID', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', 'not-a-uuid')
        .attach('file', makePdfBuffer(), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/providerId must be a valid UUID/);
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', VALID_PROVIDER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No file uploaded/);
    });

    it('should return 400 when the file exceeds 10 MB', async () => {
      // Build a buffer that starts with PDF magic bytes then is padded to 11 MB
      const oversized = Buffer.alloc(11 * 1024 * 1024);
      Buffer.from('%PDF-1.4 ', 'ascii').copy(oversized);

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', VALID_PROVIDER_ID)
        .attach('file', oversized, {
          filename: 'big.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/maximum allowed size/);
    });

    it('should return 400 when the file is not a real PDF', async () => {
      // PNG magic bytes (full IHDR so file-type can detect it)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/invoices/upload')
        .field('providerId', VALID_PROVIDER_ID)
        .attach('file', pngBuffer, {
          filename: 'sneaky.pdf', // extension says PDF...
          contentType: 'application/pdf', // header says PDF...
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid file type/);
    });
  });

  // --- GET /invoices ---

  describe('GET /api/v1/invoices', () => {
    beforeAll(() => {
      currentUser = FAKE_USER;
    });

    it('should return 200 with a paginated list of invoices', async () => {
      const fakeItems = [
        {
          invoiceId: 'inv-001',
          status: 'PENDING',
          uploaderId: FAKE_USER.userId,
          providerId: 'prov-1',
          amount: 100,
          date: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
        },
      ];

      mockListUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { items: fakeItems, total: 1, page: 1, limit: 20 },
      });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices',
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].invoiceId).toBe('inv-001');
      expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 20 });
    });

    it('should pass query params (page, limit, status, sort) to the use case', async () => {
      mockListUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { items: [], total: 0, page: 2, limit: 10 },
      });

      await request(app.getHttpServer()).get('/api/v1/invoices').query({
        page: '2',
        limit: '10',
        status: 'PENDING',
        sort: 'createdAt:desc',
      });

      const callArg = mockListUseCase.execute.mock.calls.at(-1)?.[0] as Record<
        string,
        unknown
      >;
      expect(callArg.page).toBe(2);
      expect(callArg.limit).toBe(10);
      expect(callArg.status).toBe('PENDING');
      expect(callArg.sort).toBe('createdAt:desc');
    });

    it('should forward the requesterId and requesterRole from the JWT', async () => {
      mockListUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { items: [], total: 0, page: 1, limit: 20 },
      });

      await request(app.getHttpServer()).get('/api/v1/invoices');

      const callArg = mockListUseCase.execute.mock.calls.at(-1)?.[0] as Record<
        string,
        unknown
      >;
      expect(callArg.requesterId).toBe(FAKE_USER.userId);
      expect(callArg.requesterRole).toBe('uploader');
    });

    it('should return 400 when page is not a valid number', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .query({ page: 'abc' });

      expect(response.status).toBe(400);
    });
  });

  // --- GET /invoices/:id ---

  describe('GET /api/v1/invoices/:id', () => {
    beforeAll(() => {
      currentUser = FAKE_USER;
    });

    const fakeInvoice = {
      invoiceId: 'inv-abc',
      status: 'APPROVED',
      uploaderId: FAKE_USER.userId,
      providerId: 'prov-1',
      filePath: 'some-file.pdf',
      amount: 250,
      date: new Date('2025-06-01'),
      createdAt: new Date('2025-06-01'),
      approverId: null,
      rejectionReason: null,
      validationErrors: [],
    };

    it('should return 200 with the invoice detail', async () => {
      mockGetUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeInvoice,
      });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-abc',
      );

      expect(response.status).toBe(200);
      expect(response.body.data.invoiceId).toBe('inv-abc');
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should forward the invoiceId param and user to the use case', async () => {
      mockGetUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeInvoice,
      });

      await request(app.getHttpServer()).get('/api/v1/invoices/inv-abc');

      const callArg = mockGetUseCase.execute.mock.calls.at(-1)?.[0] as Record<
        string,
        unknown
      >;
      expect(callArg.invoiceId).toBe('inv-abc');
      expect(callArg.requesterId).toBe(FAKE_USER.userId);
      expect(callArg.requesterRole).toBe('uploader');
    });

    it('should throw (→ 404) when the use case returns InvoiceNotFoundError', async () => {
      mockGetUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvoiceNotFoundError('inv-missing'),
      });

      // Without DomainErrorFilter wired in the test app this becomes a 500.
      // We only assert the error propagates (not a 200).
      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-missing',
      );

      expect(response.status).not.toBe(200);
    });
  });

  // --- PATCH /invoices/:id/approve ---

  describe('PATCH /api/v1/invoices/:id/approve', () => {
    beforeAll(() => {
      currentUser = FAKE_APPROVER;
    });

    it('should return 200 with approved invoice data on success', async () => {
      const fakeOutput = {
        invoiceId: 'inv-approve-1',
        status: 'APPROVED',
        approverId: FAKE_APPROVER.userId,
      };

      mockApproveUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeOutput,
      });

      const response = await request(app.getHttpServer()).patch(
        '/api/v1/invoices/inv-approve-1/approve',
      );

      expect(response.status).toBe(200);
      expect(response.body.data.invoiceId).toBe('inv-approve-1');
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should forward invoiceId and approverId from JWT to the use case', async () => {
      mockApproveUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: {
          invoiceId: 'inv-x',
          status: 'APPROVED',
          approverId: FAKE_APPROVER.userId,
        },
      });

      await request(app.getHttpServer()).patch(
        '/api/v1/invoices/inv-x/approve',
      );

      const callArg = mockApproveUseCase.execute.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>;
      expect(callArg.invoiceId).toBe('inv-x');
      expect(callArg.approverId).toBe(FAKE_APPROVER.userId);
    });

    it('should propagate error (not 200) when invoice is not found', async () => {
      mockApproveUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvoiceNotFoundError('inv-missing'),
      });

      const response = await request(app.getHttpServer()).patch(
        '/api/v1/invoices/inv-missing/approve',
      );

      expect(response.status).not.toBe(200);
    });

    it('should propagate error (not 200) when invoice is in invalid state', async () => {
      mockApproveUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvalidStateTransitionError('PENDING', 'APPROVED'),
      });

      const response = await request(app.getHttpServer()).patch(
        '/api/v1/invoices/inv-pending/approve',
      );

      expect(response.status).not.toBe(200);
    });
  });

  // --- PATCH /invoices/:id/reject ---

  describe('PATCH /api/v1/invoices/:id/reject', () => {
    beforeAll(() => {
      currentUser = FAKE_APPROVER;
    });

    it('should return 200 with rejected invoice data on success', async () => {
      const fakeOutput = {
        invoiceId: 'inv-reject-1',
        status: 'REJECTED',
        approverId: FAKE_APPROVER.userId,
        reason: 'Duplicate invoice',
      };

      mockRejectUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeOutput,
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-reject-1/reject')
        .send({ reason: 'Duplicate invoice' });

      expect(response.status).toBe(200);
      expect(response.body.data.invoiceId).toBe('inv-reject-1');
      expect(response.body.data.status).toBe('REJECTED');
      expect(response.body.data.reason).toBe('Duplicate invoice');
    });

    it('should forward invoiceId, approverId and reason to the use case', async () => {
      mockRejectUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: {
          invoiceId: 'inv-y',
          status: 'REJECTED',
          approverId: FAKE_APPROVER.userId,
          reason: 'Bad total',
        },
      });

      await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-y/reject')
        .send({ reason: 'Bad total' });

      const callArg = mockRejectUseCase.execute.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>;
      expect(callArg.invoiceId).toBe('inv-y');
      expect(callArg.approverId).toBe(FAKE_APPROVER.userId);
      expect(callArg.reason).toBe('Bad total');
    });

    it('should return 400 when reason is missing from body', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-z/reject')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 when reason is an empty string', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-z/reject')
        .send({ reason: '' });

      expect(response.status).toBe(400);
    });

    it('should propagate error (not 200) when invoice is not found', async () => {
      mockRejectUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvoiceNotFoundError('inv-missing'),
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-missing/reject')
        .send({ reason: 'Something' });

      expect(response.status).not.toBe(200);
    });

    it('should propagate error (not 200) when invoice is in invalid state', async () => {
      mockRejectUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvalidStateTransitionError('PENDING', 'REJECTED'),
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/invoices/inv-pending/reject')
        .send({ reason: 'Something' });

      expect(response.status).not.toBe(200);
    });
  });

  // --- GET /invoices/:id/events ---

  describe('GET /api/v1/invoices/:id/events', () => {
    beforeAll(() => {
      currentUser = FAKE_VALIDATOR;
    });

    const fakeEvents = [
      {
        id: 'evt-001',
        invoiceId: 'inv-evt-1',
        from: 'PENDING',
        to: 'PROCESSING',
        userId: 'user-1',
        timestamp: new Date('2025-06-01T10:00:00Z'),
      },
      {
        id: 'evt-002',
        invoiceId: 'inv-evt-1',
        from: 'PROCESSING',
        to: 'EXTRACTED',
        userId: 'user-2',
        timestamp: new Date('2025-06-01T10:05:00Z'),
      },
    ];

    it('should return 200 with the event history', async () => {
      mockGetEventsUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: fakeEvents,
      });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-evt-1/events',
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].from).toBe('PENDING');
      expect(response.body.data[0].to).toBe('PROCESSING');
      expect(response.body.data[1].from).toBe('PROCESSING');
      expect(response.body.data[1].to).toBe('EXTRACTED');
    });

    it('should forward invoiceId param and requester info to the use case', async () => {
      mockGetEventsUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: [],
      });

      await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-evt-99/events',
      );

      const callArg = mockGetEventsUseCase.execute.mock.calls.at(
        -1,
      )?.[0] as Record<string, unknown>;
      expect(callArg.invoiceId).toBe('inv-evt-99');
      expect(callArg.requesterId).toBe(FAKE_VALIDATOR.userId);
      expect(callArg.requesterRole).toBe('validator');
    });

    it('should return 200 with empty array when invoice has no events', async () => {
      mockGetEventsUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: [],
      });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-empty/events',
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should propagate error (not 200) when invoice is not found', async () => {
      mockGetEventsUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: new InvoiceNotFoundError('inv-missing'),
      });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/invoices/inv-missing/events',
      );

      expect(response.status).not.toBe(200);
    });
  });
});
