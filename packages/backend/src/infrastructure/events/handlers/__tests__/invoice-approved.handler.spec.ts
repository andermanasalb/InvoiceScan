import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceApprovedHandler } from '../invoice-approved.handler';
import { InvoiceApprovedEvent } from '../../../../domain/events/invoice-approved.event';
import type { NotificationPort } from '../../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../../domain/repositories';
import type { UserRepository } from '../../../../domain/repositories/user.repository';
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

const INVOICE_ID = 'inv-approved-001';
const UPLOADER_ID = 'user-uploader-001';
const VALIDATOR_ID = 'user-validator-001';
const APPROVER_ID = 'user-approver-001';

function makeApprovedEvent(
  overrides?: Partial<{ invoiceId: string; approverId: string }>,
): InvoiceApprovedEvent {
  return new InvoiceApprovedEvent({
    invoiceId: overrides?.invoiceId ?? INVOICE_ID,
    approverId: overrides?.approverId ?? APPROVER_ID,
    status: 'APPROVED',
  });
}

function makeInvoiceWithValidator() {
  const invoice = createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID });
  invoice.startProcessing()._unsafeUnwrap();
  invoice
    .markExtracted(createExtractedData({ rawText: 'test' }))
    ._unsafeUnwrap();
  invoice.markReadyForValidation(VALIDATOR_ID)._unsafeUnwrap();
  invoice.markReadyForApproval()._unsafeUnwrap();
  return invoice;
}

function makeInvoiceWithoutValidator() {
  const invoice = createInvoice({ id: INVOICE_ID, uploaderId: UPLOADER_ID });
  return invoice;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceApprovedHandler', () => {
  let mockNotifier: NotificationPort;
  let mockInvoiceRepo: InvoiceRepository;
  let mockUserRepo: UserRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let handler: InvoiceApprovedHandler;

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
    mockNotifier = { notifyStatusChange: vi.fn().mockResolvedValue(undefined) };

    mockInvoiceRepo = {
      findById: vi.fn().mockResolvedValue(makeInvoiceWithValidator()),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn(),
      countByStatusForUploader: vi.fn(),
      findByUploaderIds: vi.fn(),
      countByStatusForUploaderIds: vi.fn(),
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

    mockNoteRepo = {
      save: vi.fn(),
      findByInvoiceId: vi.fn().mockResolvedValue([]),
    };

    handler = new InvoiceApprovedHandler(
      mockNotifier,
      mockInvoiceRepo,
      mockUserRepo,
      mockNoteRepo,
    );
  });

  describe('handle', () => {
    it('should call notifyStatusChange with eventType approved', async () => {
      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'approved' }),
      );
    });

    it('should include both uploader and validator emails (deduplicated)', async () => {
      await handler.handle(makeApprovedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.toEmails).toContain('uploader@example.com');
      expect(call.toEmails).toContain('validator@example.com');
      expect(call.toEmails).toHaveLength(2);
    });

    it('should deduplicate when uploader and validator are the same person', async () => {
      // Invoice where uploader IS the validator
      const samePersonId = 'user-same-person';
      const samePersonInvoice = createInvoice({
        id: INVOICE_ID,
        uploaderId: samePersonId,
      });
      samePersonInvoice.startProcessing()._unsafeUnwrap();
      samePersonInvoice
        .markExtracted(createExtractedData({ rawText: 'test' }))
        ._unsafeUnwrap();
      samePersonInvoice.markReadyForValidation(samePersonId)._unsafeUnwrap();
      samePersonInvoice.markReadyForApproval()._unsafeUnwrap();
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        samePersonInvoice,
      );

      const samePerson = createUser({
        id: samePersonId,
        email: 'same@example.com',
        role: UserRole.VALIDATOR,
      });
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        samePerson,
      );

      await handler.handle(makeApprovedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.toEmails).toHaveLength(1);
      expect(call.toEmails[0]).toBe('same@example.com');
    });

    it('should include invoiceId in the notification payload', async () => {
      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: INVOICE_ID }),
      );
    });

    it('should include actorEmail (approver) in the payload', async () => {
      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ actorEmail: 'approver@example.com' }),
      );
    });

    it('should include the latest note when notes exist', async () => {
      (
        mockNoteRepo.findByInvoiceId as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        {
          id: 'note-1',
          invoiceId: INVOICE_ID,
          authorId: VALIDATOR_ID,
          content: 'First note',
          createdAt: new Date(),
        },
        {
          id: 'note-2',
          invoiceId: INVOICE_ID,
          authorId: APPROVER_ID,
          content: 'Latest note here',
          createdAt: new Date(),
        },
      ]);

      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ latestNote: 'Latest note here' }),
      );
    });

    it('should not include latestNote when no notes exist', async () => {
      await handler.handle(makeApprovedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.latestNote).toBeUndefined();
    });

    it('should return early without calling notifyStatusChange when invoice is not found', async () => {
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early without notifying when no recipients can be resolved', async () => {
      // Invoice with no validator, uploader also not found
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeInvoiceWithoutValidator(),
      );
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeApprovedEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should still notify uploader when validator is not found', async () => {
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (id: string) => {
          if (id === UPLOADER_ID) return uploaderUser;
          return null; // validator and approver not found
        },
      );

      await handler.handle(makeApprovedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.toEmails).toEqual(['uploader@example.com']);
    });
  });
});
