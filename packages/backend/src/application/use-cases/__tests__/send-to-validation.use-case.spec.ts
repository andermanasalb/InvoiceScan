import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendToValidationUseCase } from '../send-to-validation.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { InvoiceEventRepository } from '../../../domain/repositories/invoice-event.repository';
import type { AuditPort } from '../../ports';
import type { EventBusPort } from '../../ports/event-bus.port';
import {
  createInvoice,
  createExtractedData,
} from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UPLOADER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const VALIDATOR_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const makeExtractedInvoice = () => {
  const invoice = createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'test' }))
    ._unsafeUnwrap();
  return invoice;
};

describe('SendToValidationUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockAudit: AuditPort;
  let mockEventRepo: InvoiceEventRepository;
  let mockEventBus: EventBusPort;
  let useCase: SendToValidationUseCase;

  beforeEach(() => {
    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(makeExtractedInvoice()),
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
    mockEventRepo = {
      findByInvoiceId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockEventBus = { publish: vi.fn().mockResolvedValue(undefined) };

    useCase = new SendToValidationUseCase(
      mockInvoiceRepo,
      mockAudit,
      mockEventRepo,
      mockEventBus,
    );
  });

  describe('execute', () => {
    it('should return ok with READY_FOR_VALIDATION status when invoice is EXTRACTED', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(
        InvoiceStatusEnum.READY_FOR_VALIDATION,
      );
    });

    it('should allow the uploader to send their own invoice to validation', async () => {
      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: UPLOADER_ID,
        validatorRole: 'uploader',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return err SELF_ACTION_NOT_ALLOWED when a validator tries to validate their own invoice', async () => {
      // Invoice uploaded by VALIDATOR_ID
      const selfInvoice = createInvoice({
        id: INVOICE_ID,
        uploaderId: VALIDATOR_ID,
      });
      selfInvoice.startProcessing()._unsafeUnwrap();
      selfInvoice
        .markExtracted(createExtractedData({ rawText: 'test' }))
        ._unsafeUnwrap();
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(selfInvoice);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('SELF_ACTION_NOT_ALLOWED');
    });

    it('should allow admin to send their own invoice to validation', async () => {
      const selfInvoice = createInvoice({
        id: INVOICE_ID,
        uploaderId: VALIDATOR_ID,
      });
      selfInvoice.startProcessing()._unsafeUnwrap();
      selfInvoice
        .markExtracted(createExtractedData({ rawText: 'test' }))
        ._unsafeUnwrap();
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(selfInvoice);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'admin',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return err INVOICE_NOT_FOUND when invoice does not exist', async () => {
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return err INVALID_STATE_TRANSITION when invoice is not in EXTRACTED state', async () => {
      const pendingInvoice = createInvoice({ id: INVOICE_ID });
      mockInvoiceRepo.findById = vi.fn().mockResolvedValue(pendingInvoice);

      const result = await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should publish a domain event via eventBus', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(mockEventBus.publish).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action send_to_validation', async () => {
      await useCase.execute({
        invoiceId: INVOICE_ID,
        validatorId: VALIDATOR_ID,
        validatorRole: 'validator',
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'send_to_validation',
          userId: VALIDATOR_ID,
        }),
      );
    });
  });
});
