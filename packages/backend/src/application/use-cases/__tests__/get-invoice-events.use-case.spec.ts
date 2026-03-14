import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvoiceEventsUseCase } from '../get-invoice-events.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { InvoiceEventRepository } from '../../../domain/repositories/invoice-event.repository';
import { createInvoice } from '../../../domain/test/factories/invoice.factory';
import { createInvoiceEvent } from '../../../domain/test/factories/invoice-event.factory';
import { UserRole } from '../../../domain/entities/user.entity';
import { InvoiceStatusEnum } from '../../../domain/value-objects';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UPLOADER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const USER_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123';

describe('GetInvoiceEventsUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockEventRepo: InvoiceEventRepository;
  let useCase: GetInvoiceEventsUseCase;

  const fakeEvents = [
    createInvoiceEvent({
      invoiceId: INVOICE_ID,
      from: InvoiceStatusEnum.PENDING,
      to: InvoiceStatusEnum.PROCESSING,
      userId: USER_ID,
    }),
    createInvoiceEvent({
      invoiceId: INVOICE_ID,
      from: InvoiceStatusEnum.PROCESSING,
      to: InvoiceStatusEnum.EXTRACTED,
      userId: USER_ID,
    }),
  ];

  beforeEach(() => {
    mockInvoiceRepo = {
      findById: vi
        .fn()
        .mockResolvedValue(
          createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID }),
        ),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      findByUploaderIds: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
    };

    mockEventRepo = {
      findByInvoiceId: vi.fn().mockResolvedValue(fakeEvents),
      save: vi.fn(),
    };

    useCase = new GetInvoiceEventsUseCase(mockInvoiceRepo, mockEventRepo);
  });

  describe('execute', () => {
    it('should return the event history when requester is the invoice owner', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isOk()).toBe(true);
      const events = result._unsafeUnwrap();
      expect(events).toHaveLength(2);
      expect(events[0].from).toBe(InvoiceStatusEnum.PENDING);
      expect(events[0].to).toBe(InvoiceStatusEnum.PROCESSING);
      expect(events[1].from).toBe(InvoiceStatusEnum.PROCESSING);
      expect(events[1].to).toBe(InvoiceStatusEnum.EXTRACTED);
    });

    it('should return events when requester is a validator (full access)', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: 'other-user-id',
        requesterRole: UserRole.VALIDATOR,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(2);
    });

    it('should return events when requester is an approver (full access)', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: 'other-user-id',
        requesterRole: UserRole.APPROVER,
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return empty array when invoice has no events', async () => {
      mockEventRepo.findByInvoiceId = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it('should return INVOICE_NOT_FOUND error when invoice does not exist', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return UNAUTHORIZED error when uploader tries to access another user invoice', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('UNAUTHORIZED');
    });

    it('should call invoiceEventRepo.findByInvoiceId with the correct invoiceId', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: UPLOADER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(mockEventRepo.findByInvoiceId).toHaveBeenCalledWith(INVOICE_ID);
    });
  });
});
