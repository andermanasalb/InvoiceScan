import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError, SelfActionNotAllowedError } from '../../domain/errors';
import { SendToApprovalInput, SendToApprovalOutput } from '../dtos/send-to-approval.dto';

/**
 * SendToApprovalUseCase
 *
 * Moves an invoice from READY_FOR_VALIDATION → READY_FOR_APPROVAL.
 *
 * Allowed roles: approver, admin.
 * Ownership rules:
 *  1. The uploader of the invoice cannot trigger this action (except admin).
 *  2. The validator who moved it to READY_FOR_VALIDATION cannot also send it
 *     to approval — this enforces a two-person check (approver/admin who
 *     validated must not be the same as the one approving).
 */
export class SendToApprovalUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly invoiceEventRepo?: InvoiceEventRepository,
  ) {}

  async execute(
    input: SendToApprovalInput,
  ): Promise<Result<SendToApprovalOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // Ownership check 1: non-admins cannot act on their own invoices
    if (input.validatorRole !== 'admin' && input.validatorId === invoice.getUploaderId()) {
      return err(new SelfActionNotAllowedError());
    }

    // Ownership check 2: whoever validated the invoice cannot also send it to approval
    if (input.validatorRole !== 'admin' && invoice.getValidatorId() !== null && input.validatorId === invoice.getValidatorId()) {
      return err(new SelfActionNotAllowedError());
    }

    const fromStatus = invoice.getStatus().getValue();
    const result = invoice.markReadyForApproval();
    if (result.isErr()) return err(result.error);

    await this.invoiceRepo.save(invoice);

    if (this.invoiceEventRepo) {
      const event = InvoiceEvent.create({
        id: randomUUID(),
        invoiceId: invoice.getId(),
        from: fromStatus as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        to: invoice.getStatus().getValue() as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        userId: input.validatorId,
        timestamp: new Date(),
      });
      if (event.isOk()) await this.invoiceEventRepo.save(event.value);
    }

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
