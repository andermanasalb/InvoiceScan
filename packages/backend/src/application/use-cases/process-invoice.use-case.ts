import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
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
    private readonly invoiceEventRepo?: InvoiceEventRepository,
  ) {}

  private async recordEvent(
    invoiceId: string,
    from: string,
    to: string,
    userId: string,
  ): Promise<void> {
    if (!this.invoiceEventRepo) return;
    const event = InvoiceEvent.create({
      id: randomUUID(),
      invoiceId,
      from: from as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
      to: to as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
      userId,
      timestamp: new Date(),
    });
    if (event.isOk()) {
      await this.invoiceEventRepo.save(event.value);
    }
  }

  async execute(
    input: ProcessInvoiceInput,
  ): Promise<Result<ProcessInvoiceOutput, DomainError>> {
    // 1. Cargar la factura
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const uploaderId = invoice.getUploaderId();
    const prevStatus = invoice.getStatus().getValue();

    // 2. PENDING → PROCESSING
    const startResult = invoice.startProcessing();
    if (startResult.isErr()) return err(startResult.error);

    // Persistir PROCESSING inmediatamente para que el frontend lo vea
    await this.invoiceRepo.save(invoice);
    await this.recordEvent(
      invoice.getId(),
      prevStatus,
      invoice.getStatus().getValue(),
      uploaderId,
    );

    // 3. Cargar el PDF desde storage
    const buffer = await this.storage.get(invoice.getFilePath());

    // 4. OCR
    const ocrResult = await this.ocr.extractText(buffer);

    if (ocrResult.isErr()) {
      // OCR falló → VALIDATION_FAILED
      const fromStatus = invoice.getStatus().getValue();
      invoice.markValidationFailed([ocrResult.error.message])._unsafeUnwrap();
      await this.invoiceRepo.save(invoice);
      await this.recordEvent(
        invoice.getId(),
        fromStatus,
        invoice.getStatus().getValue(),
        uploaderId,
      );
      await this.auditor.record({
        action: 'process',
        resourceId: invoice.getId(),
        userId: uploaderId,
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
      const fromStatus = invoice.getStatus().getValue();
      invoice.markValidationFailed([llmResult.error.message])._unsafeUnwrap();
      await this.invoiceRepo.save(invoice);
      await this.recordEvent(
        invoice.getId(),
        fromStatus,
        invoice.getStatus().getValue(),
        uploaderId,
      );
      await this.auditor.record({
        action: 'process',
        resourceId: invoice.getId(),
        userId: uploaderId,
      });
      return ok({
        invoiceId: invoice.getId(),
        status: invoice.getStatus().getValue(),
        extractedData: null,
      });
    }

    // 6. PROCESSING → EXTRACTED (con todos los campos)
    // La factura queda en EXTRACTED para que el validator la revise
    // manualmente antes de pasar a READY_FOR_APPROVAL (send-to-approval).
    const fromStatus = invoice.getStatus().getValue();
    const extractedData: ExtractedData = {
      rawText,
      ...llmResult.value,
    };
    invoice.markExtracted(extractedData)._unsafeUnwrap();

    // 7. Persistir
    await this.invoiceRepo.save(invoice);
    await this.recordEvent(
      invoice.getId(),
      fromStatus,
      invoice.getStatus().getValue(),
      uploaderId,
    );

    // 8. Audit
    await this.auditor.record({
      action: 'process',
      resourceId: invoice.getId(),
      userId: uploaderId,
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      extractedData: invoice.getExtractedData(),
    });
  }
}
