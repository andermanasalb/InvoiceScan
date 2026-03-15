import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceApprovedEvent } from '../../../domain/events/invoice-approved.event';
import type { NotificationPort } from '../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { UserRepository } from '../../../domain/repositories/user.repository';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { INVOICE_NOTE_REPOSITORY } from '../../../domain/repositories/invoice-note.repository';

export const NOTIFICATION_TOKEN = 'NOTIFICATION_TOKEN';

/**
 * InvoiceApprovedHandler
 *
 * Listens for 'invoice.approved' events emitted by the outbox poller.
 *
 * Notifies both the uploader and the validator (deduplicated — one email
 * if they are the same person).
 */
@Injectable()
export class InvoiceApprovedHandler {
  constructor(
    @InjectPinoLogger(InvoiceApprovedHandler.name)
    private readonly logger: PinoLogger,
    @Inject(NOTIFICATION_TOKEN)
    private readonly notifier: NotificationPort,
    @Inject('InvoiceRepository')
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('UserRepository')
    private readonly userRepo: UserRepository,
    @Inject(INVOICE_NOTE_REPOSITORY)
    private readonly noteRepo: InvoiceNoteRepository,
  ) {}

  @OnEvent('invoice.approved', { async: true })
  async handle(event: InvoiceApprovedEvent): Promise<void> {
    const { invoiceId, approverId } = event.payload;

    this.logger.info({ invoiceId, approverId }, 'invoice.approved received');

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      this.logger.warn({ invoiceId }, 'Invoice not found for notification');
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
        { invoiceId },
        'No recipients resolved for approved notification — skipping',
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
      eventType: 'approved',
      invoiceId,
      toEmails,
      invoiceNumber: extractedData?.numeroFactura ?? undefined,
      vendorName: extractedData?.nombreEmisor ?? undefined,
      amount: extractedData?.total ?? undefined,
      actorEmail,
      latestNote,
    });
  }
}
