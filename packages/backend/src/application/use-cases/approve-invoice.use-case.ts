import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { EventBusPort } from '../ports/event-bus.port';
import { ApproveInvoiceInput, ApproveInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError, SelfActionNotAllowedError } from '../../domain/errors';
import { InvoiceApprovedEvent } from '../../domain/events/invoice-approved.event';

export class ApproveInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly eventBus: EventBusPort,
    private readonly invoiceEventRepo?: InvoiceEventRepository,
  ) {}

  async execute(
    input: ApproveInvoiceInput,
  ): Promise<Result<ApproveInvoiceOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // Ownership check: non-admins cannot act on their own invoices
    if (input.approverRole !== 'admin' && input.approverId === invoice.getUploaderId()) {
      return err(new SelfActionNotAllowedError());
    }

    const fromStatus = invoice.getStatus().getValue();
    const approveResult = invoice.approve(input.approverId);
    if (approveResult.isErr()) return err(approveResult.error);

    await this.invoiceRepo.save(invoice);

    if (this.invoiceEventRepo) {
      const event = InvoiceEvent.create({
        id: randomUUID(),
        invoiceId: invoice.getId(),
        from: fromStatus as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        to: invoice.getStatus().getValue() as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        userId: input.approverId,
        timestamp: new Date(),
      });
      if (event.isOk()) await this.invoiceEventRepo.save(event.value);
    }

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
