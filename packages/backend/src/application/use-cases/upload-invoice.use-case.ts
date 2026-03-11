import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { StoragePort, AuditPort } from '../ports';
import { UploadInvoiceInput, UploadInvoiceOutput } from '../dtos';
import { Invoice } from '../../domain/entities';
import { InvoiceAmount, InvoiceDate } from '../../domain/value-objects';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidFieldError } from '../../domain/errors';

export class UploadInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly storage: StoragePort,
    private readonly auditor: AuditPort,
  ) {}

  async execute(
    input: UploadInvoiceInput,
  ): Promise<Result<UploadInvoiceOutput, DomainError>> {
    if (!input.providerId || input.providerId.trim().length === 0) {
      return err(new InvalidFieldError('providerId', 'Provider ID cannot be empty'));
    }

    // Default amount and date — will be replaced after OCR in FASE 5
    const amount = InvoiceAmount.createPlaceholder();

    const dateResult = InvoiceDate.create(new Date());
    if (dateResult.isErr()) return err(dateResult.error);

    const stored = await this.storage.save(input.fileBuffer, input.mimeType);

    const invoiceResult = Invoice.create({
      id: randomUUID(),
      providerId: input.providerId,
      uploaderId: input.uploaderId,
      filePath: stored.key,
      amount: amount,
      date: dateResult.value,
      createdAt: new Date(),
    });

    if (invoiceResult.isErr()) return err(invoiceResult.error);
    const invoice = invoiceResult.value;

    await this.invoiceRepo.save(invoice);

    await this.auditor.record({
      action: 'upload',
      resourceId: invoice.getId(),
      userId: input.uploaderId,
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      filePath: invoice.getFilePath(),
      uploaderId: invoice.getUploaderId(),
      providerId: invoice.getProviderId(),
      createdAt: invoice.getCreatedAt(),
    });
  }
}
