import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { EventBusPort } from '../ports/event-bus.port';
import { DomainError } from '../../domain/errors/domain.error';
import {
  InvoiceNotFoundError,
  SelfActionNotAllowedError,
} from '../../domain/errors';
import {
  SendToValidationInput,
  SendToValidationOutput,
} from '../dtos/send-to-validation.dto';
import { InvoiceSentForValidationEvent } from '../../domain/events/invoice-sent-for-validation.event';

/**
 * SendToValidationUseCase
 *
 * Moves an invoice from EXTRACTED → READY_FOR_VALIDATION.
 *
 * Allowed roles: validator, approver, admin.
 * Ownership rule: the uploader of the invoice cannot trigger this action
 * (except admin, who can act on any invoice).
 *
 * The validatorId is recorded on the invoice so that the send-to-approval
 * step can enforce that the same person cannot also send it to approval.
 */
export class SendToValidationUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly invoiceEventRepo: InvoiceEventRepository,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    input: SendToValidationInput,
  ): Promise<Result<SendToValidationOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // Ownership check: only non-owners can trigger this, EXCEPT the uploader
    // (the uploader reviews the AI-extracted data and sends it to validation themselves)
    // and admin (who can act on any invoice).
    if (
      input.validatorRole !== 'admin' &&
      input.validatorRole !== 'uploader' &&
      input.validatorId === invoice.getUploaderId()
    ) {
      return err(new SelfActionNotAllowedError());
    }

    const fromStatus = invoice.getStatus().getValue();
    const result = invoice.markReadyForValidation(input.validatorId);
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
      new InvoiceSentForValidationEvent({
        invoiceId: invoice.getId(),
        sentById: input.validatorId,
        status: invoice.getStatus().getValue(),
      }),
    );

    await this.auditor.record({
      action: 'send_to_validation',
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
