import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/db/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_TOKEN } from '../../infrastructure/storage/local-storage.adapter';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import {
  NoOpAuditAdapter,
  AUDIT_TOKEN,
} from '../../infrastructure/audit/no-op-audit.adapter';
import {
  PdfParseAdapter,
  OCR_TOKEN,
} from '../../infrastructure/ocr/pdf-parse.adapter';
import { AIStudioAdapter } from '../../infrastructure/llm/ai-studio.adapter';
import { LLM_TOKEN } from '../../application/ports/llm.port';
import { INVOICE_EVENT_REPOSITORY } from '../../domain/repositories/invoice-event.repository';
import { InvoiceApprovedHandler } from '../../infrastructure/events/handlers/invoice-approved.handler';
import { InvoiceRejectedHandler } from '../../infrastructure/events/handlers/invoice-rejected.handler';
import { ProcessInvoiceUseCase } from '../../application/use-cases/process-invoice.use-case';
import {
  ProcessInvoiceWorker,
  PROCESS_INVOICE_USE_CASE_TOKEN,
} from './process-invoice.worker';
import { OutboxPollerWorker } from './outbox-poller.worker';
import type { InvoiceRepository } from '../../domain/repositories';
import type { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import type { StoragePort } from '../../application/ports/storage.port';
import type { AuditPort } from '../../application/ports/audit.port';
import type { OcrPort } from '../../application/ports/ocr.port';
import type { LLMPort } from '../../application/ports/llm.port';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    QueueModule,
    // EventEmitterModule is already registered globally in AppModule — do NOT add forRoot() here.
  ],
  providers: [
    // OCR adapter — extrae texto embebido de PDFs digitales
    {
      provide: OCR_TOKEN,
      useClass: PdfParseAdapter,
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
        const model =
          config.get<string>('AISTUDIO_MODEL') ?? 'gemini-1.5-flash';
        return new AIStudioAdapter(apiKey, model);
      },
      inject: [ConfigService],
    },
    // Wire ProcessInvoiceUseCase con los 6 parámetros (incluye InvoiceEventRepository)
    {
      provide: PROCESS_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        storage: StoragePort,
        ocr: OcrPort,
        auditor: AuditPort,
        llm: LLMPort,
        invoiceEventRepo: InvoiceEventRepository,
      ) =>
        new ProcessInvoiceUseCase(
          invoiceRepo,
          storage,
          ocr,
          auditor,
          llm,
          invoiceEventRepo,
        ),
      inject: [
        'InvoiceRepository',
        STORAGE_TOKEN,
        OCR_TOKEN,
        AUDIT_TOKEN,
        LLM_TOKEN,
        INVOICE_EVENT_REPOSITORY,
      ],
    },
    // Worker — procesa jobs de la cola 'process-invoice'
    ProcessInvoiceWorker,
    // Worker — lee outbox_events cada 10s y emite al EventEmitter
    OutboxPollerWorker,
    // Handlers de eventos — escuchan al EventEmitter (no-op hasta FASE 11)
    InvoiceApprovedHandler,
    InvoiceRejectedHandler,
  ],
})
export class JobsModule {}
