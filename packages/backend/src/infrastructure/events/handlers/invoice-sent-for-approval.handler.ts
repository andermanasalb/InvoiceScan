import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceSentForApprovalEvent } from '../../../domain/events/invoice-sent-for-approval.event';
import type { NotificationPort } from '../../../application/ports/notification.port';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { UserRepository } from '../../../domain/repositories/user.repository';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';
import type { InvoiceNoteRepository } from '../../../domain/repositories/invoice-note.repository';
import { NOTIFICATION_TOKEN } from './invoice-approved.handler';
import { ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/assignment.repository';
import { INVOICE_NOTE_REPOSITORY } from '../../../domain/repositories/invoice-note.repository';

/**
 * InvoiceSentForApprovalHandler
 *
 * Listens for 'invoice.sent_for_approval' events emitted by the outbox poller.
 *
 * Logic:
 *  - Load invoice → get validatorId stored on the invoice
 *  - Get the assigned approver for that validator
 *  - If no approver found → log warning and return silently
 *  - Send notification to approver
 */
@Injectable()
export class InvoiceSentForApprovalHandler {
  constructor(
    @InjectPinoLogger(InvoiceSentForApprovalHandler.name)
    private readonly logger: PinoLogger,
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

  @OnEvent('invoice.sent_for_approval', { async: true })
  async handle(event: InvoiceSentForApprovalEvent): Promise<void> {
    const { invoiceId, sentById } = event.payload;

    this.logger.info(
      { invoiceId, sentById },
      'invoice.sent_for_approval received',
    );

    // Load invoice to get validatorId and extracted data
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      this.logger.warn({ invoiceId }, 'Invoice not found for notification');
      return;
    }

    const validatorId = invoice.getValidatorId();
    const extractedData = invoice.getExtractedData();

    if (!validatorId) {
      this.logger.warn(
        { invoiceId },
        'Invoice has no validatorId — cannot resolve approver',
      );
      return;
    }

    // Get the approver assigned to this validator
    const approverId =
      await this.assignmentRepo.getAssignedApproverForValidator(validatorId);
    if (!approverId) {
      this.logger.warn(
        { invoiceId, validatorId },
        'No approver assigned for validator — skipping notification',
      );
      return;
    }

    const approver = await this.userRepo.findById(approverId);
    if (!approver) {
      this.logger.warn({ invoiceId, approverId }, 'Approver user not found');
      return;
    }

    // Load actor (who clicked "Send to Approval")
    const actor = await this.userRepo.findById(sentById);
    const actorEmail = actor?.getEmail();

    // Fetch latest note
    const notes = await this.noteRepo.findByInvoiceId(invoiceId);
    const latestNote = notes.length
      ? notes[notes.length - 1].content
      : undefined;

    await this.notifier.notifyStatusChange({
      eventType: 'sent_for_approval',
      invoiceId,
      toEmails: [approver.getEmail()],
      invoiceNumber: extractedData?.numeroFactura ?? undefined,
      vendorName: extractedData?.nombreEmisor ?? undefined,
      amount: extractedData?.total ?? undefined,
      actorEmail,
      latestNote,
    });
  }
}
