import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/db/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_TOKEN } from '../../infrastructure/storage/local-storage.adapter';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { NoOpAuditAdapter, AUDIT_TOKEN } from '../../infrastructure/audit/no-op-audit.adapter';
import { TesseractAdapter, OCR_TOKEN } from '../../infrastructure/ocr/tesseract.adapter';
import { AIStudioAdapter } from '../../infrastructure/llm/ai-studio.adapter';
import { LLM_TOKEN } from '../../application/ports/llm.port';
import { ProcessInvoiceUseCase } from '../../application/use-cases/process-invoice.use-case';
import {
  ProcessInvoiceWorker,
  PROCESS_INVOICE_USE_CASE_TOKEN,
} from './process-invoice.worker';
import type { InvoiceRepository } from '../../domain/repositories';
import type { StoragePort } from '../../application/ports/storage.port';
import type { AuditPort } from '../../application/ports/audit.port';
import type { OcrPort } from '../../application/ports/ocr.port';
import type { LLMPort } from '../../application/ports/llm.port';

@Module({
  imports: [DatabaseModule, StorageModule, QueueModule],
  providers: [
    // OCR adapter
    {
      provide: OCR_TOKEN,
      useClass: TesseractAdapter,
    },
    // Audit adapter (temporal)
    {
      provide: AUDIT_TOKEN,
      useClass: NoOpAuditAdapter,
    },
    // LLM adapter — lee API key y modelo desde ConfigService
    {
      provide: LLM_TOKEN,
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('AISTUDIO_API_KEY') ?? '';
        const model = config.get<string>('AISTUDIO_MODEL') ?? 'gemini-1.5-flash';
        return new AIStudioAdapter(apiKey, model);
      },
      inject: [ConfigService],
    },
    // Wire ProcessInvoiceUseCase con los 5 parámetros
    {
      provide: PROCESS_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        storage: StoragePort,
        ocr: OcrPort,
        auditor: AuditPort,
        llm: LLMPort,
      ) => new ProcessInvoiceUseCase(invoiceRepo, storage, ocr, auditor, llm),
      inject: ['InvoiceRepository', STORAGE_TOKEN, OCR_TOKEN, AUDIT_TOKEN, LLM_TOKEN],
    },
    // Worker — procesa jobs de la cola 'process-invoice'
    ProcessInvoiceWorker,
  ],
})
export class JobsModule {}
