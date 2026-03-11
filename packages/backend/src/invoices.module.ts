import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { STORAGE_TOKEN } from './infrastructure/storage/local-storage.adapter';
import { NoOpAuditAdapter, AUDIT_TOKEN } from './infrastructure/audit/no-op-audit.adapter';
import { InvoiceQueueService } from './infrastructure/queue/invoice-queue.service';
import { UploadInvoiceUseCase } from './application/use-cases/upload-invoice.use-case';
import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
} from './interface/http/controllers/invoices.controller';
import type { InvoiceRepository } from './domain/repositories';
import type { StoragePort } from './application/ports/storage.port';
import type { AuditPort } from './application/ports/audit.port';
import type { InvoiceQueuePort } from './infrastructure/queue/invoice-queue.service';

/**
 * InvoicesModule
 *
 * Wires together everything needed to handle invoice HTTP requests:
 *
 *   HTTP request
 *     → InvoicesController
 *       → UploadInvoiceUseCase
 *           → InvoiceRepository  (from DatabaseModule)
 *           → StoragePort        (from StorageModule via STORAGE_TOKEN)
 *           → AuditPort          (NoOpAuditAdapter for now, real one in FASE 9)
 *           → InvoiceQueuePort   (InvoiceQueueService — encola el job de OCR)
 *
 * El OCR se procesa en background via ProcessInvoiceWorker (JobsModule).
 */
@Module({
  imports: [DatabaseModule, StorageModule, QueueModule],
  controllers: [InvoicesController],
  providers: [
    // Temporary no-op auditor — replaced with real TypeORM impl in FASE 9
    {
      provide: AUDIT_TOKEN,
      useClass: NoOpAuditAdapter,
    },
    // Wire the use case with all its dependencies via injection tokens
    {
      provide: UPLOAD_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        storage: StoragePort,
        auditor: AuditPort,
        queue: InvoiceQueuePort,
      ) => new UploadInvoiceUseCase(invoiceRepo, storage, auditor, queue),
      inject: ['InvoiceRepository', STORAGE_TOKEN, AUDIT_TOKEN, InvoiceQueueService],
    },
  ],
})
export class InvoicesModule {}
