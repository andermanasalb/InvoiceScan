import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { AuditPort } from '../ports';
import { EventBusPort } from '../ports/event-bus.port';
import { ApproveInvoiceInput, ApproveInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { InvoiceApprovedEvent } from '../../domain/events/invoice-approved.event';

export class ApproveInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    input: ApproveInvoiceInput,
  ): Promise<Result<ApproveInvoiceOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const approveResult = invoice.approve(input.approverId);
    if (approveResult.isErr()) return err(approveResult.error);

    await this.invoiceRepo.save(invoice);

    await this.auditor.record({
      action: 'approve',
      resourceId: invoice.getId(),
      userId: input.approverId,
    });

    await this.eventBus.publish(
      new InvoiceApprovedEvent({
        invoiceId: invoice.getId(),
        approverId: input.approverId,
        status: invoice.getStatus().getValue(),
      }),
    );

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      approverId: input.approverId,
    });
  }
}
