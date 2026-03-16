import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvoiceNotesUseCase } from '../get-invoice-notes.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { createInvoice } from '../../../domain/test/factories';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UPLOADER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const OTHER_UPLOADER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const makeNote = (overrides = {}) => ({
  id: 'note-id-1',
  invoiceId: INVOICE_ID,
  authorId: UPLOADER_ID,
  content: 'Test note',
  createdAt: new Date(),
  ...overrides,
});

describe('GetInvoiceNotesUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let useCase: GetInvoiceNotesUseCase;

  beforeEach(() => {
    const invoice = createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID });

    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(invoice),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      findByUploaderIds: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
      findUploaderEmail: vi.fn(),
    };

    mockNoteRepo = {
      save: vi.fn(),
      findByInvoiceId: vi.fn().mockResolvedValue([makeNote()]),
    };

    useCase = new GetInvoiceNotesUseCase(mockInvoiceRepo, mockNoteRepo);
  });

  describe('execute', () => {
    it('should return notes when requester is the uploader and invoice belongs to them', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: 'uploader',
      });

      expect(result.isOk()).toBe(true);
      const notes = result._unsafeUnwrap();
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('Test note');
    });

    it('should return err INVOICE_NOT_FOUND when uploader requests notes for another user invoice', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: OTHER_UPLOADER_ID,
        requesterRole: 'uploader',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should allow validator to access any invoice notes', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: OTHER_UPLOADER_ID,
        requesterRole: 'validator',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should allow approver to access any invoice notes', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: OTHER_UPLOADER_ID,
        requesterRole: 'approver',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should allow admin to access any invoice notes', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: OTHER_UPLOADER_ID,
        requesterRole: 'admin',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return err INVOICE_NOT_FOUND when invoice does not exist', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: 'uploader',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });
  });
});
