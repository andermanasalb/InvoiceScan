import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { AuditPort, NotificationPort } from '../ports';
import { ApproveInvoiceInput, ApproveInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { InvoiceStatusEnum } from '../../domain/value-objects';

export class ApproveInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly notifier: NotificationPort,
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

    await this.notifier.notifyStatusChange({
      invoiceId: invoice.getId(),
      status: InvoiceStatusEnum.APPROVED,
      recipientEmail: '',
      recipientName: '',
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      approverId: input.approverId,
    });
  }
}
