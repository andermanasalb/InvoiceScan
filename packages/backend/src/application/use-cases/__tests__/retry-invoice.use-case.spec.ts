import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryInvoiceUseCase } from '../retry-invoice.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { InvoiceEventRepository } from '../../../domain/repositories/invoice-event.repository';
import type { AuditPort } from '../../ports';
import type { InvoiceQueuePort } from '../../ports/invoice-queue.port';
import {
  createInvoice,
  createExtractedData,
} from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const REQUESTER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const makeValidationFailedInvoice = () => {
  const invoice = createInvoice({ id: INVOICE_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'invalid' }))
    ._unsafeUnwrap();
  invoice.markValidationFailed(['Missing required fields'])._unsafeUnwrap();
  return invoice;
};

describe('RetryInvoiceUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockQueue: InvoiceQueuePort;
  let mockEventRepo: InvoiceEventRepository;
  let useCase: RetryInvoiceUseCase;

  beforeEach(() => {
    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(makeValidationFailedInvoice()),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      findByUploaderIds: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
      findUploaderEmail: vi.fn(),
    };

    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    mockQueue = {
      enqueueProcessing: vi.fn().mockResolvedValue(undefined),
      enqueueRetry: vi.fn().mockResolvedValue(undefined),
    };
    mockEventRepo = {
      findByInvoiceId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new RetryInvoiceUseCase(
      mockInvoiceRepo,
      mockAudit,
      mockQueue,
      mockEventRepo,
    );
  });

  describe('execute', () => {
    it('should return ok with PROCESSING status when invoice is in VALIDATION_FAILED', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.PROCESSING);
    });

    it('should re-enqueue the invoice for processing via queue.enqueueRetry', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(mockQueue.enqueueRetry).toHaveBeenCalledWith(INVOICE_ID);
    });

    it('should persist the updated invoice', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(mockInvoiceRepo.save).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action retry', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'retry', userId: REQUESTER_ID }),
      );
    });

    it('should save an invoice event when invoiceEventRepo is provided', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(mockEventRepo.save).toHaveBeenCalledOnce();
    });

    it('should return err INVOICE_NOT_FOUND when invoice does not exist', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return err INVALID_STATE_TRANSITION when invoice is not in VALIDATION_FAILED', async () => {
      const pendingInvoice = createInvoice({ id: INVOICE_ID });
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(pendingInvoice);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should work without invoiceEventRepo (optional parameter)', async () => {
      const useCaseWithoutEventRepo = new RetryInvoiceUseCase(
        mockInvoiceRepo,
        mockAudit,
        mockQueue,
        // no invoiceEventRepo
      );

      const result = await useCaseWithoutEventRepo.execute({
        invoiceId: INVOICE_ID,
        requesterId: REQUESTER_ID,
      });

      expect(result.isOk()).toBe(true);
      expect(mockEventRepo.save).not.toHaveBeenCalled();
    });
  });
});
