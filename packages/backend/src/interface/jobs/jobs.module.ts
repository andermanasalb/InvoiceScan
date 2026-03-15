import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/db/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_TOKEN } from '../../infrastructure/storage/local-storage.adapter';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { NotificationModule } from '../../infrastructure/notification/notification.module';
import {
  AuditAdapter,
  AUDIT_PORT_TOKEN,
} from '../../infrastructure/audit/audit.adapter';
import {
  PdfParseAdapter,
  OCR_TOKEN,
} from '../../infrastructure/ocr/pdf-parse.adapter';
import { AIStudioAdapter } from '../../infrastructure/llm/ai-studio.adapter';
import { LLM_TOKEN } from '../../application/ports/llm.port';
import { INVOICE_EVENT_REPOSITORY } from '../../domain/repositories/invoice-event.repository';
import { InvoiceApprovedHandler } from '../../infrastructure/events/handlers/invoice-approved.handler';
import { InvoiceRejectedHandler } from '../../infrastructure/events/handlers/invoice-rejected.handler';
import { InvoiceSentForValidationHandler } from '../../infrastructure/events/handlers/invoice-sent-for-validation.handler';
import { InvoiceSentForApprovalHandler } from '../../infrastructure/events/handlers/invoice-sent-for-approval.handler';
import { ProcessInvoiceUseCase } from '../../application/use-cases/process-invoice.use-case';
import {
  ProcessInvoiceWorker,
  PROCESS_INVOICE_USE_CASE_TOKEN,
} from './process-invoice.worker';
import { OutboxPollerWorker } from './outbox-poller.worker';
import {
  ExportInvoicesWorker,
  EXPORT_INVOICE_REPOSITORY_TOKEN,
  EXPORT_ASSIGNMENT_REPOSITORY_TOKEN,
} from './export-invoices.worker';
import type { InvoiceRepository } from '../../domain/repositories';
import type { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import type { StoragePort } from '../../application/ports/storage.port';
import type { AuditPort } from '../../application/ports/audit.port';
import type { OcrPort } from '../../application/ports/ocr.port';
import type { LLMPort } from '../../application/ports/llm.port';
import type { AuditEventRepository } from '../../domain/repositories/audit-event.repository';
import { ASSIGNMENT_REPOSITORY } from '../../domain/repositories/assignment.repository';

// Re-use the same token name as InvoicesModule for consistency within this module scope
const JOBS_AUDIT_TOKEN = AUDIT_PORT_TOKEN;

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    QueueModule,
    NotificationModule,
    // EventEmitterModule is already registered globally in AppModule — do NOT add forRoot() here.
  ],
  providers: [
    // OCR adapter — extracts embedded text from digital PDFs
    {
      provide: OCR_TOKEN,
      useClass: PdfParseAdapter,
    },
    // Audit adapter — persists all worker audit events to the database.
    // Previously used NoOpAuditAdapter (FASE 4 temporary shim), now uses
    // the real TypeORM-backed implementation (fixed in cleanup pass).
    {
      provide: JOBS_AUDIT_TOKEN,
      useFactory: (auditRepo: AuditEventRepository): AuditPort =>
        new AuditAdapter(auditRepo),
      inject: ['AuditEventRepository'],
    },
    // LLM adapter — reads API key and model from ConfigService
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
    // Wire ProcessInvoiceUseCase with all 6 dependencies
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
        JOBS_AUDIT_TOKEN,
        LLM_TOKEN,
        INVOICE_EVENT_REPOSITORY,
      ],
    },
    // Worker — consumes jobs from the 'process-invoice' queue
    ProcessInvoiceWorker,
    // Worker — polls outbox_events every 10 s and emits via EventEmitter
    OutboxPollerWorker,
    // Event handlers — wired with NotificationPort + DB repos (FASE 11)
    InvoiceApprovedHandler,
    InvoiceRejectedHandler,
    InvoiceSentForValidationHandler,
    InvoiceSentForApprovalHandler,
    // Worker — consumes jobs from the 'export-invoices' queue (FASE 12)
    {
      provide: EXPORT_INVOICE_REPOSITORY_TOKEN,
      useExisting: 'InvoiceRepository',
    },
    {
      provide: EXPORT_ASSIGNMENT_REPOSITORY_TOKEN,
      useExisting: ASSIGNMENT_REPOSITORY,
    },
    ExportInvoicesWorker,
  ],
})
export class JobsModule {}
