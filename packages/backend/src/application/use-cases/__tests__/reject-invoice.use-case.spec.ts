import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RejectInvoiceUseCase } from '../reject-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { AuditPort } from '../../ports';
import { EventBusPort } from '../../ports/event-bus.port';
import {
  createInvoice,
  createExtractedData,
} from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import { InvoiceRejectedEvent } from '../../../domain/events/invoice-rejected.event';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const APPROVER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const VALIDATOR_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const makeReadyInvoice = () => {
  const invoice = createInvoice({ id: INVOICE_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'test' }))
    ._unsafeUnwrap();
  invoice.markReadyForValidation(VALIDATOR_ID)._unsafeUnwrap();
  invoice.markReadyForApproval()._unsafeUnwrap();
  return invoice;
};

describe('RejectInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockEventBus: EventBusPort;
  let useCase: RejectInvoiceUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(makeReadyInvoice()),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };

    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    mockEventBus = { publish: vi.fn().mockResolvedValue(undefined) };

    useCase = new RejectInvoiceUseCase(mockRepo, mockAudit, mockEventBus);
  });

  describe('execute', () => {
    it('should return ok with REJECTED status when invoice is ready', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Amount does not match purchase order',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.REJECTED);
    });

    it('should persist the invoice after rejection', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Invalid',
      });

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action reject', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Invalid',
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject', userId: APPROVER_ID }),
      );
    });

    it('should publish an InvoiceRejectedEvent with correct payload', async () => {
      const reason = 'Amount does not match PO';
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason,
      });

      expect(mockEventBus.publish).toHaveBeenCalledOnce();
      const publishedEvent = (mockEventBus.publish as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(InvoiceRejectedEvent);
      expect(publishedEvent.eventType).toBe('invoice.rejected');
      expect(publishedEvent.payload.invoiceId).toBe(INVOICE_ID);
      expect(publishedEvent.payload.approverId).toBe(APPROVER_ID);
      expect(publishedEvent.payload.reason).toBe(reason);
      expect(publishedEvent.payload.status).toBe(InvoiceStatusEnum.REJECTED);
    });

    it('should return err when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Invalid',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return err when invoice is not in READY_FOR_APPROVAL state', async () => {
      const pendingInvoice = createInvoice({ id: INVOICE_ID });
      mockRepo.findById = vi.fn().mockResolvedValue(pendingInvoice);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Invalid',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should not publish event when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
        reason: 'Invalid',
      });

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
