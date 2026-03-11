import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { StoragePort, AuditPort, OcrPort } from '../ports';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { Invoice } from '../../domain/entities';

export interface ProcessInvoiceInput {
  invoiceId: string;
}

export interface ProcessInvoiceOutput {
  invoiceId: string;
  status: string;
  extractedData: { rawText: string } | null;
}

export class ProcessInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly storage: StoragePort,
    private readonly ocr: OcrPort,
    private readonly auditor: AuditPort,
  ) {}

  async execute(
    input: ProcessInvoiceInput,
  ): Promise<Result<ProcessInvoiceOutput, DomainError>> {
    // 1. Cargar la factura
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // 2. PENDING → PROCESSING
    const startResult = invoice.startProcessing();
    if (startResult.isErr()) return err(startResult.error);

    // 3. Cargar el PDF desde storage
    const buffer = await this.storage.get(invoice.getFilePath());

    // 4. OCR
    const ocrResult = await this.ocr.extractText(buffer);

    if (ocrResult.isOk()) {
      // 5a. PROCESSING → EXTRACTED
      invoice.markExtracted({ rawText: ocrResult.value.text })._unsafeUnwrap();
    } else {
      // 5b. PROCESSING → VALIDATION_FAILED
      invoice.markValidationFailed([ocrResult.error.message])._unsafeUnwrap();
    }

    // 6. Persistir
    await this.invoiceRepo.save(invoice);

    // 7. Audit
    await this.auditor.record({
      action: 'process',
      resourceId: invoice.getId(),
      userId: invoice.getUploaderId(),
    });

    const extractedData = invoice.getExtractedData();

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      extractedData: extractedData ? { rawText: extractedData.rawText as string } : null,
    });
  }
}
