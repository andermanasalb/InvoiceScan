import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RejectInvoiceUseCase } from '../reject-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { AuditPort, NotificationPort } from '../../ports';
import { createInvoice, createExtractedData } from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const APPROVER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const makeReadyInvoice = () => {
  const invoice = createInvoice({ id: INVOICE_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice.markExtracted(createExtractedData({ rawText: 'test' }))._unsafeUnwrap();
  invoice.markReadyForApproval()._unsafeUnwrap();
  return invoice;
};

describe('RejectInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockNotifier: NotificationPort;
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
    mockNotifier = { notifyStatusChange: vi.fn().mockResolvedValue(undefined) };

    useCase = new RejectInvoiceUseCase(mockRepo, mockAudit, mockNotifier);
  });

  describe('execute', () => {
    it('should return ok with REJECTED status when invoice is ready', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        reason: 'Amount does not match purchase order',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.REJECTED);
    });

    it('should persist the invoice after rejection', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID, approverId: APPROVER_ID, reason: 'Invalid' });

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action reject', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID, approverId: APPROVER_ID, reason: 'Invalid' });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject', userId: APPROVER_ID }),
      );
    });

    it('should send a notification after rejection', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID, approverId: APPROVER_ID, reason: 'Invalid' });

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
    });

    it('should return err when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({ invoiceId: INVOICE_ID, approverId: APPROVER_ID, reason: 'Invalid' });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return err when invoice is not in READY_FOR_APPROVAL state', async () => {
      const pendingInvoice = createInvoice({ id: INVOICE_ID });
      mockRepo.findById = vi.fn().mockResolvedValue(pendingInvoice);

      const result = await useCase.execute({ invoiceId: INVOICE_ID, approverId: APPROVER_ID, reason: 'Invalid' });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });
  });
});
