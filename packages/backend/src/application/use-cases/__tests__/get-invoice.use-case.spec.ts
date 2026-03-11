import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvoiceUseCase } from '../get-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { createInvoice } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UPLOADER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

describe('GetInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let useCase: GetInvoiceUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(
        createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID }),
      ),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new GetInvoiceUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should return the invoice when requester is the uploader', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().invoiceId).toBe(INVOICE_ID);
    });

    it('should return the invoice when requester is a validator', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: 'other-user-id',
        requesterRole: UserRole.VALIDATOR,
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return err when uploader tries to access another users invoice', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('UNAUTHORIZED');
    });

    it('should return err when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });
  });
});
