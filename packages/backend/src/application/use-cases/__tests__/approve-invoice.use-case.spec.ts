import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApproveInvoiceUseCase } from '../approve-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { AuditPort } from '../../ports';
import { EventBusPort } from '../../ports/event-bus.port';
import {
  createInvoice,
  createExtractedData,
} from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import { InvoiceApprovedEvent } from '../../../domain/events/invoice-approved.event';

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

describe('ApproveInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockEventBus: EventBusPort;
  let useCase: ApproveInvoiceUseCase;

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

    useCase = new ApproveInvoiceUseCase(mockRepo, mockAudit, mockEventBus);
  });

  describe('execute', () => {
    it('should return ok with APPROVED status when invoice is ready', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.APPROVED);
    });

    it('should persist the invoice after approval', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action approve', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approve', userId: APPROVER_ID }),
      );
    });

    it('should publish an InvoiceApprovedEvent with correct payload', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(mockEventBus.publish).toHaveBeenCalledOnce();
      const publishedEvent = (mockEventBus.publish as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(InvoiceApprovedEvent);
      expect(publishedEvent.eventType).toBe('invoice.approved');
      expect(publishedEvent.payload.invoiceId).toBe(INVOICE_ID);
      expect(publishedEvent.payload.approverId).toBe(APPROVER_ID);
      expect(publishedEvent.payload.status).toBe(InvoiceStatusEnum.APPROVED);
    });

    it('should return err when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
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
      });

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
