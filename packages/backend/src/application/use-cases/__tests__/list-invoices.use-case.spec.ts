import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListInvoicesUseCase } from '../list-invoices.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { createInvoice } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

const UPLOADER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const paginatedResult = (count = 2) => ({
  items: Array.from({ length: count }, () => createInvoice({ uploaderId: UPLOADER_ID })),
  total: count,
});

describe('ListInvoicesUseCase', () => {
  let mockRepo: InvoiceRepository;
  let useCase: ListInvoicesUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn().mockResolvedValue(paginatedResult()),
      findByUploaderId: vi.fn().mockResolvedValue(paginatedResult()),
      save: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new ListInvoicesUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should use findByUploaderId when requester is an uploader', async () => {
      await useCase.execute({
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
        page: 1,
        limit: 20,
      });

      expect(mockRepo.findByUploaderId).toHaveBeenCalledOnce();
      expect(mockRepo.findAll).not.toHaveBeenCalled();
    });

    it('should use findAll when requester is a validator', async () => {
      await useCase.execute({
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.VALIDATOR,
        page: 1,
        limit: 20,
      });

      expect(mockRepo.findAll).toHaveBeenCalledOnce();
      expect(mockRepo.findByUploaderId).not.toHaveBeenCalled();
    });

    it('should return paginated results with correct meta', async () => {
      const result = await useCase.execute({
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
        page: 1,
        limit: 20,
      });

      expect(result.isOk()).toBe(true);
      const output = result._unsafeUnwrap();
      expect(output.total).toBe(2);
      expect(output.page).toBe(1);
      expect(output.limit).toBe(20);
      expect(output.items).toHaveLength(2);
    });
  });
});
