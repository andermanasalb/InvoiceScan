import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { StoragePort, AuditPort, OcrPort, LLMPort } from '../ports';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { ExtractedData } from '../../domain/entities/invoice.entity';

export interface ProcessInvoiceInput {
  invoiceId: string;
}

export interface ProcessInvoiceOutput {
  invoiceId: string;
  status: string;
  extractedData: ExtractedData | null;
}

export class ProcessInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly storage: StoragePort,
    private readonly ocr: OcrPort,
    private readonly auditor: AuditPort,
    private readonly llm: LLMPort,
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

    if (ocrResult.isErr()) {
      // OCR falló → VALIDATION_FAILED
      invoice.markValidationFailed([ocrResult.error.message])._unsafeUnwrap();
      await this.invoiceRepo.save(invoice);
      await this.auditor.record({
        action: 'process',
        resourceId: invoice.getId(),
        userId: invoice.getUploaderId(),
      });
      return ok({
        invoiceId: invoice.getId(),
        status: invoice.getStatus().getValue(),
        extractedData: null,
      });
    }

    // 5. LLM extraction
    const rawText = ocrResult.value.text;
    const llmResult = await this.llm.extractInvoiceData(rawText);

    if (llmResult.isErr()) {
      // LLM falló → VALIDATION_FAILED
      invoice.markValidationFailed([llmResult.error.message])._unsafeUnwrap();
      await this.invoiceRepo.save(invoice);
      await this.auditor.record({
        action: 'process',
        resourceId: invoice.getId(),
        userId: invoice.getUploaderId(),
      });
      return ok({
        invoiceId: invoice.getId(),
        status: invoice.getStatus().getValue(),
        extractedData: null,
      });
    }

    // 6. PROCESSING → EXTRACTED (con todos los campos)
    const extractedData: ExtractedData = {
      rawText,
      ...llmResult.value,
    };
    invoice.markExtracted(extractedData)._unsafeUnwrap();

    // 7. EXTRACTED → READY_FOR_APPROVAL
    invoice.markReadyForApproval()._unsafeUnwrap();

    // 8. Persistir
    await this.invoiceRepo.save(invoice);

    // 9. Audit
    await this.auditor.record({
      action: 'process',
      resourceId: invoice.getId(),
      userId: invoice.getUploaderId(),
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      extractedData: invoice.getExtractedData(),
    });
  }
}
