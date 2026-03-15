import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import { InvoiceSentForValidationHandler } from '../invoice-sent-for-validation.handler';
import { InvoiceSentForValidationEvent } from '../../../../domain/events/invoice-sent-for-validation.event';
import type { NotificationPort } from '../../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../../domain/repositories';
import type { UserRepository } from '../../../../domain/repositories/user.repository';
import type { AssignmentRepository } from '../../../../domain/repositories/assignment.repository';
import type { InvoiceNoteRepository } from '../../../../domain/repositories/invoice-note.repository';
import {
  createInvoice,
  createUser,
  createExtractedData,
} from '../../../../domain/test/factories';
import { UserRole } from '../../../../domain/entities/user.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INVOICE_ID = 'inv-sfv-001';
const UPLOADER_ID = 'user-uploader-001';
const VALIDATOR_ID = 'user-validator-001';
const APPROVER_ID = 'user-approver-001';

function makeSentForValidationEvent(
  sentById: string,
): InvoiceSentForValidationEvent {
  return new InvoiceSentForValidationEvent({
    invoiceId: INVOICE_ID,
    sentById,
    status: 'READY_FOR_VALIDATION',
  });
}

function makeExtractedInvoice(uploaderId = UPLOADER_ID) {
  const invoice = createInvoice({ id: INVOICE_ID, uploaderId });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'test' }))
    ._unsafeUnwrap();
  return invoice;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceSentForValidationHandler', () => {
  let mockNotifier: NotificationPort;
  let mockInvoiceRepo: InvoiceRepository;
  let mockUserRepo: UserRepository;
  let mockAssignmentRepo: AssignmentRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let handler: InvoiceSentForValidationHandler;

  const uploaderUser = createUser({
    id: UPLOADER_ID,
    email: 'uploader@example.com',
    role: UserRole.UPLOADER,
  });
  const validatorUser = createUser({
    id: VALIDATOR_ID,
    email: 'validator@example.com',
    role: UserRole.VALIDATOR,
  });
  const approverUser = createUser({
    id: APPROVER_ID,
    email: 'approver@example.com',
    role: UserRole.APPROVER,
  });

  beforeEach(() => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as PinoLogger;

    mockNotifier = { notifyStatusChange: vi.fn().mockResolvedValue(undefined) };

    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(makeExtractedInvoice()),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      findByUploaderIds: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
      findUploaderEmail: vi.fn(),
    };

    mockUserRepo = {
      findById: vi.fn().mockImplementation((id: string) => {
        if (id === UPLOADER_ID) return Promise.resolve(uploaderUser);
        if (id === VALIDATOR_ID) return Promise.resolve(validatorUser);
        if (id === APPROVER_ID) return Promise.resolve(approverUser);
        return Promise.resolve(null);
      }),
      findByEmail: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
    };

    mockAssignmentRepo = {
      assignUploaderToValidator: vi.fn(),
      assignValidatorToApprover: vi.fn(),
      removeUploaderAssignment: vi.fn(),
      removeValidatorAssignment: vi.fn(),
      getAssignedUploaderIds: vi.fn(),
      getAssignedValidatorIds: vi.fn(),
      getAssignedValidatorForUploader: vi.fn().mockResolvedValue(VALIDATOR_ID),
      getAssignedApproverForValidator: vi.fn().mockResolvedValue(APPROVER_ID),
      getFullTree: vi.fn(),
    };

    mockNoteRepo = {
      save: vi.fn(),
      findByInvoiceId: vi.fn().mockResolvedValue([]),
    };

    handler = new InvoiceSentForValidationHandler(
      mockLogger,
      mockNotifier,
      mockInvoiceRepo,
      mockUserRepo,
      mockAssignmentRepo,
      mockNoteRepo,
    );
  });

  describe('handle — uploader flow', () => {
    it('should notify the assigned validator with eventType sent_for_validation', async () => {
      // Actor is an uploader
      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'sent_for_validation',
          toEmails: ['validator@example.com'],
        }),
      );
    });

    it('should look up the assigned validator for the uploader', async () => {
      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(
        mockAssignmentRepo.getAssignedValidatorForUploader,
      ).toHaveBeenCalledWith(UPLOADER_ID);
    });

    it('should include actorEmail in the payload', async () => {
      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ actorEmail: 'uploader@example.com' }),
      );
    });

    it('should return early when no validator is assigned to the uploader', async () => {
      (
        mockAssignmentRepo.getAssignedValidatorForUploader as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(null);

      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('handle — self-upload flow (validator/approver/admin)', () => {
    it('should notify the assigned approver with eventType sent_for_validation_self when actor is validator', async () => {
      // Actor is a validator uploading their own invoice
      const validatorAsUploaderInvoice = makeExtractedInvoice(VALIDATOR_ID);
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        validatorAsUploaderInvoice,
      );

      await handler.handle(makeSentForValidationEvent(VALIDATOR_ID));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'sent_for_validation_self',
          toEmails: ['approver@example.com'],
        }),
      );
    });

    it('should look up the assigned approver for the validator in self-upload flow', async () => {
      const validatorAsUploaderInvoice = makeExtractedInvoice(VALIDATOR_ID);
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        validatorAsUploaderInvoice,
      );

      await handler.handle(makeSentForValidationEvent(VALIDATOR_ID));

      expect(
        mockAssignmentRepo.getAssignedApproverForValidator,
      ).toHaveBeenCalledWith(VALIDATOR_ID);
    });

    it('should notify approver when actor is approver role', async () => {
      const approverAsUploaderInvoice = makeExtractedInvoice(APPROVER_ID);
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        approverAsUploaderInvoice,
      );
      (
        mockAssignmentRepo.getAssignedApproverForValidator as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(APPROVER_ID);

      await handler.handle(makeSentForValidationEvent(APPROVER_ID));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'sent_for_validation_self' }),
      );
    });

    it('should return early when no approver is assigned in self-upload flow', async () => {
      const validatorAsUploaderInvoice = makeExtractedInvoice(VALIDATOR_ID);
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        validatorAsUploaderInvoice,
      );
      (
        mockAssignmentRepo.getAssignedApproverForValidator as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(null);

      await handler.handle(makeSentForValidationEvent(VALIDATOR_ID));

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('handle — guard clauses', () => {
    it('should return early when invoice is not found', async () => {
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early when actor user is not found', async () => {
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early when recipient user record is not found', async () => {
      // Validator ID is resolved but the user record doesn't exist
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (id: string) => {
          if (id === UPLOADER_ID) return uploaderUser;
          return null; // validator user missing
        },
      );

      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should include latest note in payload when notes exist', async () => {
      (
        mockNoteRepo.findByInvoiceId as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'note-1',
          invoiceId: INVOICE_ID,
          authorId: UPLOADER_ID,
          content: 'Please check the total',
          createdAt: new Date(),
        },
      ]);

      await handler.handle(makeSentForValidationEvent(UPLOADER_ID));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ latestNote: 'Please check the total' }),
      );
    });
  });
});
