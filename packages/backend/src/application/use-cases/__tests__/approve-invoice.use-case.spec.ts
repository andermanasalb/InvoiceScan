import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApproveInvoiceUseCase } from '../approve-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { AuditPort } from '../../ports';
import { UnitOfWorkPort, UoWContext } from '../../ports/unit-of-work.port';
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

/**
 * Creates a mock UnitOfWorkPort that executes the callback directly
 * (no real transaction — unit test boundary).
 */
const makeMockUow = (ctx: Partial<UoWContext> = {}): UnitOfWorkPort => ({
  execute: vi.fn(async (fn) => {
    const fullCtx: UoWContext = {
      invoiceRepo: {
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploaderId: vi.fn(),
        findByUploaderIds: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        countByStatus: vi.fn(),
        countByStatusForUploader: vi.fn(),
        countByStatusForUploaderIds: vi.fn(),
        findUploaderEmail: vi.fn(),
        ...ctx.invoiceRepo,
      },
      invoiceEventRepo: {
        findByInvoiceId: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        ...ctx.invoiceEventRepo,
      },
      outboxRepo: {
        save: vi.fn().mockResolvedValue(undefined),
        findUnprocessed: vi.fn(),
        markProcessed: vi.fn(),
        ...ctx.outboxRepo,
      },
    };
    return fn(fullCtx);
  }),
});

describe('ApproveInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockUow: UnitOfWorkPort;
  let useCase: ApproveInvoiceUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(makeReadyInvoice()),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      findByUploaderIds: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
      findUploaderEmail: vi.fn(),
    };

    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    mockUow = makeMockUow();

    useCase = new ApproveInvoiceUseCase(mockRepo, mockAudit, mockUow);
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

    it('should persist the invoice atomically via UoW', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(mockUow.execute).toHaveBeenCalledOnce();
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

    it('should publish an InvoiceApprovedEvent inside the UoW via outboxRepo', async () => {
      let capturedOutboxSave: ReturnType<typeof vi.fn> | undefined;

      mockUow = {
        execute: vi.fn(async (fn) => {
          const ctx: UoWContext = {
            invoiceRepo: {
              findById: vi.fn(),
              findAll: vi.fn(),
              findByUploaderId: vi.fn(),
              findByUploaderIds: vi.fn(),
              save: vi.fn().mockResolvedValue(undefined),
              delete: vi.fn(),
              countByStatus: vi.fn(),
              countByStatusForUploader: vi.fn(),
              countByStatusForUploaderIds: vi.fn(),
              findUploaderEmail: vi.fn(),
            },
            invoiceEventRepo: {
              findByInvoiceId: vi.fn(),
              save: vi.fn().mockResolvedValue(undefined),
            },
            outboxRepo: {
              save: (capturedOutboxSave = vi.fn().mockResolvedValue(undefined)),
              findUnprocessed: vi.fn(),
              markProcessed: vi.fn(),
            },
          };
          return fn(ctx);
        }),
      };

      useCase = new ApproveInvoiceUseCase(mockRepo, mockAudit, mockUow);

      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(capturedOutboxSave).toHaveBeenCalledOnce();
      const savedEvent = (capturedOutboxSave as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(savedEvent).toBeInstanceOf(InvoiceApprovedEvent);
      expect(savedEvent.eventType).toBe('invoice.approved');
      expect(savedEvent.payload.invoiceId).toBe(INVOICE_ID);
      expect(savedEvent.payload.approverId).toBe(APPROVER_ID);
      expect(savedEvent.payload.status).toBe(InvoiceStatusEnum.APPROVED);
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

    it('should not call UoW when invoice is not found', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      await useCase.execute({
        invoiceId: INVOICE_ID,
        approverId: APPROVER_ID,
        approverRole: 'approver',
      });

      expect(mockUow.execute).not.toHaveBeenCalled();
    });
  });
});
