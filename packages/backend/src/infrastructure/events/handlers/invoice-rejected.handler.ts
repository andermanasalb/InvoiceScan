import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceRejectedEvent } from '../../../domain/events/invoice-rejected.event';
import type { NotificationPort } from '../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { UserRepository } from '../../../domain/repositories/user.repository';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { NOTIFICATION_TOKEN } from './invoice-approved.handler';
import { INVOICE_NOTE_REPOSITORY } from '../../../domain/repositories/invoice-note.repository';

/**
 * InvoiceRejectedHandler
 *
 * Listens for 'invoice.rejected' events emitted by the outbox poller.
 *
 * Notifies both the uploader and the validator (deduplicated). Rejection
 * reason from the event payload is always shown prominently in the email.
 */
@Injectable()
export class InvoiceRejectedHandler {
  private readonly logger = new Logger(InvoiceRejectedHandler.name);

  constructor(
    @Inject(NOTIFICATION_TOKEN)
    private readonly notifier: NotificationPort,
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('UserRepository')
    private readonly userRepo: UserRepository,
    @Inject(INVOICE_NOTE_REPOSITORY)
    private readonly noteRepo: InvoiceNoteRepository,
  ) {}

  @OnEvent('invoice.rejected', { async: true })
  async handle(event: InvoiceRejectedEvent): Promise<void> {
    const { invoiceId, approverId, reason } = event.payload;

    this.logger.log('invoice.rejected received', {
      invoiceId,
      approverId,
      reason,
    });

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      this.logger.warn('Invoice not found for notification', { invoiceId });
      return;
    }

    const uploaderId = invoice.getUploaderId();
    const validatorId = invoice.getValidatorId();
    const extractedData = invoice.getExtractedData();

    // Resolve email addresses (non-null only), deduplicated via Set
    const emailSet = new Set<string>();

    const uploader = await this.userRepo.findById(uploaderId);
    if (uploader) emailSet.add(uploader.getEmail());

    if (validatorId) {
      const validator = await this.userRepo.findById(validatorId);
      if (validator) emailSet.add(validator.getEmail());
    }

    const toEmails = [...emailSet];
    if (!toEmails.length) {
      this.logger.warn(
        'No recipients resolved for rejected notification — skipping',
        {
          invoiceId,
        },
      );
      return;
    }

    const actor = await this.userRepo.findById(approverId);
    const actorEmail = actor?.getEmail();

    const notes = await this.noteRepo.findByInvoiceId(invoiceId);
    const latestNote = notes.length
      ? notes[notes.length - 1].content
      : undefined;

    await this.notifier.notifyStatusChange({
      eventType: 'rejected',
      invoiceId,
      toEmails,
      invoiceNumber: extractedData?.numeroFactura ?? undefined,
      vendorName: extractedData?.nombreEmisor ?? undefined,
      amount: extractedData?.total ?? undefined,
      actorEmail,
      latestNote,
      rejectionReason: reason,
    });
  }
}
