import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import { InvoiceSentForApprovalHandler } from '../invoice-sent-for-approval.handler';
import { InvoiceSentForApprovalEvent } from '../../../../domain/events/invoice-sent-for-approval.event';
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

const INVOICE_ID = 'inv-sfa-001';
const UPLOADER_ID = 'user-uploader-001';
const VALIDATOR_ID = 'user-validator-001';
const APPROVER_ID = 'user-approver-001';
const SENDER_ID = 'user-sender-001';

function makeSentForApprovalEvent(
  overrides?: Partial<{ invoiceId: string; sentById: string }>,
): InvoiceSentForApprovalEvent {
  return new InvoiceSentForApprovalEvent({
    invoiceId: overrides?.invoiceId ?? INVOICE_ID,
    sentById: overrides?.sentById ?? SENDER_ID,
    status: 'READY_FOR_APPROVAL',
  });
}

function makeInvoiceReadyForApproval() {
  const invoice = createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'test' }))
    ._unsafeUnwrap();
  invoice.markReadyForValidation(VALIDATOR_ID)._unsafeUnwrap();
  invoice.markReadyForApproval()._unsafeUnwrap();
  return invoice;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceSentForApprovalHandler', () => {
  let mockNotifier: NotificationPort;
  let mockInvoiceRepo: InvoiceRepository;
  let mockUserRepo: UserRepository;
  let mockAssignmentRepo: AssignmentRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let handler: InvoiceSentForApprovalHandler;

  const senderUser = createUser({
    id: SENDER_ID,
    email: 'sender@example.com',
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
      findById: vi.fn().mockResolvedValue(makeInvoiceReadyForApproval()),
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
        if (id === SENDER_ID) return Promise.resolve(senderUser);
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
      getAssignedValidatorForUploader: vi.fn(),
      getAssignedApproverForValidator: vi.fn().mockResolvedValue(APPROVER_ID),
      getFullTree: vi.fn(),
    };

    mockNoteRepo = {
      save: vi.fn(),
      findByInvoiceId: vi.fn().mockResolvedValue([]),
    };

    handler = new InvoiceSentForApprovalHandler(
      mockLogger,
      mockNotifier,
      mockInvoiceRepo,
      mockUserRepo,
      mockAssignmentRepo,
      mockNoteRepo,
    );
  });

  describe('handle', () => {
    it('should call notifyStatusChange with eventType sent_for_approval', async () => {
      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'sent_for_approval' }),
      );
    });

    it('should send the notification to the assigned approver', async () => {
      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ toEmails: ['approver@example.com'] }),
      );
    });

    it('should look up the approver using the validator stored on the invoice', async () => {
      await handler.handle(makeSentForApprovalEvent());

      expect(
        mockAssignmentRepo.getAssignedApproverForValidator,
      ).toHaveBeenCalledWith(VALIDATOR_ID);
    });

    it('should include the invoiceId in the payload', async () => {
      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: INVOICE_ID }),
      );
    });

    it('should include actorEmail (sender) in the payload', async () => {
      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ actorEmail: 'sender@example.com' }),
      );
    });

    it('should include the latest note when notes exist', async () => {
      (
        mockNoteRepo.findByInvoiceId as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'note-1',
          invoiceId: INVOICE_ID,
          authorId: SENDER_ID,
          content: 'Ready for approval — all data validated',
          createdAt: new Date(),
        },
      ]);

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latestNote: 'Ready for approval — all data validated',
        }),
      );
    });

    it('should return early without notifying when invoice is not found', async () => {
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early when invoice has no validatorId', async () => {
      // Invoice never sent through validation step → no validatorId
      const invoiceWithoutValidator = createInvoice({
        id: INVOICE_ID,
        uploaderId: UPLOADER_ID,
      });
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        invoiceWithoutValidator,
      );

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early when no approver is assigned for the validator', async () => {
      (
        mockAssignmentRepo.getAssignedApproverForValidator as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(null);

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early when the approver user record is not found', async () => {
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (id: string) => {
          if (id === SENDER_ID) return senderUser;
          return null; // approver record missing
        },
      );

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should still notify even when actor (sentById) user record is not found', async () => {
      // actorEmail will be undefined, but the notification should still go out
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (id: string) => {
          if (id === APPROVER_ID) return approverUser;
          return null; // sender not found
        },
      );

      await handler.handle(makeSentForApprovalEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.actorEmail).toBeUndefined();
      expect(call.toEmails).toEqual(['approver@example.com']);
    });
  });
});
