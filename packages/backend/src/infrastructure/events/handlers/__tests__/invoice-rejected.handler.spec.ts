import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceRejectedHandler } from '../invoice-rejected.handler';
import { InvoiceRejectedEvent } from '../../../../domain/events/invoice-rejected.event';
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

const INVOICE_ID = 'inv-rejected-001';
const UPLOADER_ID = 'user-uploader-001';
const VALIDATOR_ID = 'user-validator-001';
const APPROVER_ID = 'user-approver-001';
const REJECTION_REASON = 'Missing VAT number on invoice';

function makeRejectedEvent(
  overrides?: Partial<{
    invoiceId: string;
    approverId: string;
    reason: string;
  }>,
): InvoiceRejectedEvent {
  return new InvoiceRejectedEvent({
    invoiceId: overrides?.invoiceId ?? INVOICE_ID,
    approverId: overrides?.approverId ?? APPROVER_ID,
    reason: overrides?.reason ?? REJECTION_REASON,
    status: 'REJECTED',
  });
}

function makeReadyInvoice() {
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

describe('InvoiceRejectedHandler', () => {
  let mockNotifier: NotificationPort;
  let mockInvoiceRepo: InvoiceRepository;
  let mockUserRepo: UserRepository;
  let mockNoteRepo: InvoiceNoteRepository;
  let handler: InvoiceRejectedHandler;

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
      findById: vi.fn().mockResolvedValue(makeReadyInvoice()),
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

    handler = new InvoiceRejectedHandler(
      mockNotifier,
      mockInvoiceRepo,
      mockUserRepo,
      mockNoteRepo,
    );
  });

  describe('handle', () => {
    it('should call notifyStatusChange with eventType rejected', async () => {
      await handler.handle(makeRejectedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledOnce();
      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'rejected' }),
      );
    });

    it('should include the rejection reason in the payload', async () => {
      await handler.handle(makeRejectedEvent({ reason: REJECTION_REASON }));

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ rejectionReason: REJECTION_REASON }),
      );
    });

    it('should include both uploader and validator emails', async () => {
      await handler.handle(makeRejectedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.toEmails).toContain('uploader@example.com');
      expect(call.toEmails).toContain('validator@example.com');
      expect(call.toEmails).toHaveLength(2);
    });

    it('should deduplicate when uploader and validator are the same person', async () => {
      const samePersonId = 'user-same-001';
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

      await handler.handle(makeRejectedEvent());

      const call = (mockNotifier.notifyStatusChange as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.toEmails).toHaveLength(1);
    });

    it('should include actorEmail (approver) in the payload', async () => {
      await handler.handle(makeRejectedEvent());

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
          authorId: APPROVER_ID,
          content: 'Old note',
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'note-2',
          invoiceId: INVOICE_ID,
          authorId: APPROVER_ID,
          content: 'Rejection note detail',
          createdAt: new Date('2025-01-02'),
        },
      ]);

      await handler.handle(makeRejectedEvent());

      expect(mockNotifier.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ latestNote: 'Rejection note detail' }),
      );
    });

    it('should return early without notifying when invoice is not found', async () => {
      (mockInvoiceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeRejectedEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });

    it('should return early without notifying when no recipients can be resolved', async () => {
      (mockUserRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await handler.handle(makeRejectedEvent());

      expect(mockNotifier.notifyStatusChange).not.toHaveBeenCalled();
    });
  });
});
