import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { EventBusPort } from '../ports/event-bus.port';
import { DomainError } from '../../domain/errors/domain.error';
import {
  InvoiceNotFoundError,
  NotAssignedError,
  SelfActionNotAllowedError,
} from '../../domain/errors';
import {
  SendToApprovalInput,
  SendToApprovalOutput,
} from '../dtos/send-to-approval.dto';
import { InvoiceSentForApprovalEvent } from '../../domain/events/invoice-sent-for-approval.event';

/**
 * SendToApprovalUseCase
 *
 * Moves an invoice from READY_FOR_VALIDATION → READY_FOR_APPROVAL.
 *
 * Allowed roles: validator, approver, admin.
 * Ownership rules:
 *  1. The uploader of the invoice cannot trigger this action (except admin).
 *  2. Validators must have an approver assigned (admin exempt).
 */
export class SendToApprovalUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly invoiceEventRepo: InvoiceEventRepository,
    private readonly eventBus: EventBusPort,
    private readonly assignmentRepo: AssignmentRepository,
  ) {}

  async execute(
    input: SendToApprovalInput,
  ): Promise<Result<SendToApprovalOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // Ownership check: non-admins cannot act on their own invoices
    if (
      input.validatorRole !== 'admin' &&
      input.validatorId === invoice.getUploaderId()
    ) {
      return err(new SelfActionNotAllowedError());
    }

    // Assignment check: validators must have an approver assigned
    if (input.validatorRole === 'validator') {
      const approverId = await this.assignmentRepo.getAssignedApproverForValidator(input.validatorId);
      if (!approverId) {
        return err(new NotAssignedError('You are not assigned to an approver. Ask an admin to assign you before sending to approval.'));
      }
    }

    const fromStatus = invoice.getStatus().getValue();
    const result = invoice.markReadyForApproval();
    if (result.isErr()) return err(result.error);

    await this.invoiceRepo.save(invoice);

    const invoiceEvent = InvoiceEvent.create({
      id: randomUUID(),
      invoiceId: invoice.getId(),
      from: fromStatus as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
      to: invoice
        .getStatus()
        .getValue() as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
      userId: input.validatorId,
      timestamp: new Date(),
    });
    if (invoiceEvent.isOk())
      await this.invoiceEventRepo.save(invoiceEvent.value);

    await this.eventBus.publish(
      new InvoiceSentForApprovalEvent({
        invoiceId: invoice.getId(),
        sentById: input.validatorId,
        status: invoice.getStatus().getValue(),
      }),
    );

    await this.auditor.record({
      action: 'send_to_approval',
      resourceId: invoice.getId(),
      userId: input.validatorId,
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      validatorId: input.validatorId,
    });
  }
}
