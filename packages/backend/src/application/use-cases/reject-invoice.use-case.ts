import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { AuditPort, NotificationPort } from '../ports';
import { RejectInvoiceInput, RejectInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { InvoiceStatusEnum } from '../../domain/value-objects';

export class RejectInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly notifier: NotificationPort,
  ) {}

  async execute(
    input: RejectInvoiceInput,
  ): Promise<Result<RejectInvoiceOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const rejectResult = invoice.reject(input.approverId, input.reason);
    if (rejectResult.isErr()) return err(rejectResult.error);

    await this.invoiceRepo.save(invoice);

    await this.auditor.record({
      action: 'reject',
      resourceId: invoice.getId(),
      userId: input.approverId,
    });

    await this.notifier.notifyStatusChange({
      invoiceId: invoice.getId(),
      status: InvoiceStatusEnum.REJECTED,
      recipientEmail: '',
      recipientName: '',
      notes: input.reason,
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      approverId: input.approverId,
      reason: input.reason,
    });
  }
}
