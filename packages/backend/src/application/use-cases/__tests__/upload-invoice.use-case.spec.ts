import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadInvoiceUseCase } from '../upload-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { StoragePort } from '../../ports';
import { AuditPort } from '../../ports';
import { UploadInvoiceInput } from '../../dtos';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import type { InvoiceQueuePort } from '../../../application/ports/invoice-queue.port';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';

const makeInput = (
  overrides?: Partial<UploadInvoiceInput>,
): UploadInvoiceInput => ({
  uploaderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  uploaderRole: 'admin',
  providerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  fileBuffer: Buffer.from('fake-pdf'),
  mimeType: 'application/pdf',
  fileSizeBytes: 1024,
  ...overrides,
});

describe('UploadInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockStorage: StoragePort;
  let mockAudit: AuditPort;
  let mockQueue: InvoiceQueuePort;
  let mockAssignmentRepo: AssignmentRepository;
  let useCase: UploadInvoiceUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
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

    mockStorage = {
      save: vi.fn().mockResolvedValue({
        key: 'uploads/fake-uuid.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
      get: vi.fn(),
      delete: vi.fn(),
      getSignedUrl: vi.fn(),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockQueue = {
      enqueueProcessing: vi.fn().mockResolvedValue(undefined),
      enqueueRetry: vi.fn().mockResolvedValue(undefined),
    };

    mockAssignmentRepo = {
      assignUploaderToValidator: vi.fn(),
      assignValidatorToApprover: vi.fn(),
      removeUploaderAssignment: vi.fn(),
      removeValidatorAssignment: vi.fn(),
      getAssignedUploaderIds: vi.fn(),
      getAssignedValidatorIds: vi.fn(),
      getAssignedValidatorForUploader: vi
        .fn()
        .mockResolvedValue('validator-id'),
      getAssignedApproverForValidator: vi.fn().mockResolvedValue('approver-id'),
      getFullTree: vi.fn(),
    };

    useCase = new UploadInvoiceUseCase(
      mockRepo,
      mockStorage,
      mockAudit,
      mockQueue,
      mockAssignmentRepo,
    );
  });

  describe('execute', () => {
    it('should return ok with invoice data when input is valid', async () => {
      const result = await useCase.execute(makeInput());

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.PENDING);
    });

    it('should save the file to storage', async () => {
      await useCase.execute(makeInput());

      expect(mockStorage.save).toHaveBeenCalledOnce();
    });

    it('should persist the invoice in the repository', async () => {
      await useCase.execute(makeInput());

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should enqueue the OCR job after saving the invoice', async () => {
      const result = await useCase.execute(makeInput());

      expect(mockQueue.enqueueProcessing).toHaveBeenCalledOnce();
      expect(mockQueue.enqueueProcessing).toHaveBeenCalledWith(
        result._unsafeUnwrap().invoiceId,
      );
    });

    it('should record an audit event', async () => {
      await useCase.execute(makeInput());

      expect(mockAudit.record).toHaveBeenCalledOnce();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'upload' }),
      );
    });

    it('should return err when providerId is missing', async () => {
      const result = await useCase.execute(
        makeInput({
          providerId:
            '' as unknown as `${string}-${string}-${string}-${string}-${string}`,
        }),
      );

      expect(result.isErr()).toBe(true);
    });
  });
});
