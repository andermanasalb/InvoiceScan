import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddNoteUseCase } from '../add-note.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { createInvoice } from '../../../domain/test/factories';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const AUTHOR_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('AddNoteUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let useCase: AddNoteUseCase;

  beforeEach(() => {
    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(createInvoice({ id: INVOICE_ID })),
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
      save: vi.fn().mockResolvedValue(undefined),
      findByInvoiceId: vi.fn().mockResolvedValue([]),
    };

    useCase = new AddNoteUseCase(mockInvoiceRepo, mockNoteRepo);
  });

  describe('execute', () => {
    it('should return ok with noteId when invoice exists', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        authorId: AUTHOR_ID,
        content: 'Please verify the VAT number.',
      });

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.noteId).toBeTruthy();
      expect(value.invoiceId).toBe(INVOICE_ID);
      expect(value.authorId).toBe(AUTHOR_ID);
      expect(value.content).toBe('Please verify the VAT number.');
    });

    it('should persist the note via noteRepo.save', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        authorId: AUTHOR_ID,
        content: 'Note content',
      });

      expect(mockNoteRepo.save).toHaveBeenCalledOnce();
    });

    it('should return err INVOICE_NOT_FOUND when invoice does not exist', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        authorId: AUTHOR_ID,
        content: 'Note content',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should not call noteRepo.save when invoice is not found', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      await useCase.execute({
        invoiceId: INVOICE_ID,
        authorId: AUTHOR_ID,
        content: 'Note content',
      });

      expect(mockNoteRepo.save).not.toHaveBeenCalled();
    });
  });
});
