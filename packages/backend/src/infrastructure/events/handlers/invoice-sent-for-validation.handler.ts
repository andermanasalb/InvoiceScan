import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceSentForValidationEvent } from '../../../domain/events/invoice-sent-for-validation.event';
import type { NotificationPort } from '../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { UserRepository } from '../../../domain/repositories/user.repository';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { NOTIFICATION_TOKEN } from './invoice-approved.handler';
import { ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/assignment.repository';
import { INVOICE_NOTE_REPOSITORY } from '../../../domain/repositories/invoice-note.repository';

/**
 * InvoiceSentForValidationHandler
 *
 * Listens for 'invoice.sent_for_validation' events emitted by the outbox poller.
 *
 * Logic:
 *  - If the actor (sentById) is a validator/approver/admin (self-upload flow):
 *      → get their assigned approver → eventType = 'sent_for_validation_self'
 *  - Otherwise (normal uploader flow):
 *      → get the assigned validator for the uploader → eventType = 'sent_for_validation'
 *  - If no recipient can be resolved → log warning and return silently.
 */
@Injectable()
export class InvoiceSentForValidationHandler {
  private readonly logger = new Logger(InvoiceSentForValidationHandler.name);

  constructor(
    @Inject(NOTIFICATION_TOKEN)
    private readonly notifier: NotificationPort,
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('UserRepository')
    private readonly userRepo: UserRepository,
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepository,
    @Inject(INVOICE_NOTE_REPOSITORY)
    private readonly noteRepo: InvoiceNoteRepository,
  ) {}

  @OnEvent('invoice.sent_for_validation', { async: true })
  async handle(event: InvoiceSentForValidationEvent): Promise<void> {
    const { invoiceId, sentById } = event.payload;

    this.logger.log('invoice.sent_for_validation received', {
      invoiceId,
      sentById,
    });

    // Load invoice to get uploaderId and extracted data
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      this.logger.warn('Invoice not found for notification', { invoiceId });
      return;
    }

    const uploaderId = invoice.getUploaderId();
    const extractedData = invoice.getExtractedData();

    // Load actor (who clicked "Send to Validation")
    const actor = await this.userRepo.findById(sentById);
    if (!actor) {
      this.logger.warn('Actor user not found for notification', {
        invoiceId,
        sentById,
      });
      return;
    }

    const actorRole = actor.getRole();
    const actorEmail = actor.getEmail();

    // Determine recipient based on actor role
    let recipientId: string | null = null;
    let eventType: 'sent_for_validation' | 'sent_for_validation_self';

    const isSelfUpload =
      actorRole === 'validator' ||
      actorRole === 'approver' ||
      actorRole === 'admin';

    if (isSelfUpload) {
      // Validator/approver/admin uploaded their own invoice — notify the approver
      recipientId =
        await this.assignmentRepo.getAssignedApproverForValidator(uploaderId);
      eventType = 'sent_for_validation_self';
    } else {
      // Normal uploader — notify their assigned validator
      recipientId =
        await this.assignmentRepo.getAssignedValidatorForUploader(uploaderId);
      eventType = 'sent_for_validation';
    }

    if (!recipientId) {
      this.logger.warn(
        'No recipient found for sent_for_validation notification — skipping',
        {
          invoiceId,
          uploaderId,
          isSelfUpload,
        },
      );
      return;
    }

    const recipient = await this.userRepo.findById(recipientId);
    if (!recipient) {
      this.logger.warn('Recipient user not found', { invoiceId, recipientId });
      return;
    }

    // Fetch latest note (notes are stored ASC, so last item is most recent)
    const notes = await this.noteRepo.findByInvoiceId(invoiceId);
    const latestNote = notes.length
      ? notes[notes.length - 1].content
      : undefined;

    await this.notifier.notifyStatusChange({
      eventType,
      invoiceId,
      toEmails: [recipient.getEmail()],
      invoiceNumber: extractedData?.numeroFactura ?? undefined,
      vendorName: extractedData?.nombreEmisor ?? undefined,
      amount: extractedData?.total ?? undefined,
      actorEmail,
      latestNote,
    });
  }
}
