import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { RetryInvoiceInput, RetryInvoiceOutput } from '../dtos/retry-invoice.dto';
import type { InvoiceQueuePort } from '../../infrastructure/queue/invoice-queue.service';

export class RetryInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly queue: InvoiceQueuePort,
    private readonly invoiceEventRepo?: InvoiceEventRepository,
  ) {}

  async execute(
    input: RetryInvoiceInput,
  ): Promise<Result<RetryInvoiceOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const fromStatus = invoice.getStatus().getValue();
    const result = invoice.retry();
    if (result.isErr()) return err(result.error);

    await this.invoiceRepo.save(invoice);

    if (this.invoiceEventRepo) {
      const event = InvoiceEvent.create({
        id: randomUUID(),
        invoiceId: invoice.getId(),
        from: fromStatus as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        to: invoice.getStatus().getValue() as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
        userId: input.requesterId,
        timestamp: new Date(),
      });
      if (event.isOk()) await this.invoiceEventRepo.save(event.value);
    }

    await this.auditor.record({
      action: 'retry',
      resourceId: invoice.getId(),
      userId: input.requesterId,
    });

    // Re-encolar el job de procesamiento OCR
    // El jobId usa timestamp para evitar conflicto con el job original (mismo invoiceId)
    await this.queue.enqueueRetry(invoice.getId());

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
    });
  }
}
