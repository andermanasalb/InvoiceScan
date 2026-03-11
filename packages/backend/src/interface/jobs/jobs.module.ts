import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/db/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { STORAGE_TOKEN } from '../../infrastructure/storage/local-storage.adapter';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { NoOpAuditAdapter, AUDIT_TOKEN } from '../../infrastructure/audit/no-op-audit.adapter';
import { TesseractAdapter, OCR_TOKEN } from '../../infrastructure/ocr/tesseract.adapter';
import { ProcessInvoiceUseCase } from '../../application/use-cases/process-invoice.use-case';
import {
  ProcessInvoiceWorker,
  PROCESS_INVOICE_USE_CASE_TOKEN,
} from './process-invoice.worker';
import type { InvoiceRepository } from '../../domain/repositories';
import type { StoragePort } from '../../application/ports/storage.port';
import type { AuditPort } from '../../application/ports/audit.port';
import type { OcrPort } from '../../application/ports/ocr.port';

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
    // Wire ProcessInvoiceUseCase
    {
      provide: PROCESS_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        storage: StoragePort,
        ocr: OcrPort,
        auditor: AuditPort,
      ) => new ProcessInvoiceUseCase(invoiceRepo, storage, ocr, auditor),
      inject: ['InvoiceRepository', STORAGE_TOKEN, OCR_TOKEN, AUDIT_TOKEN],
    },
    // Worker — procesa jobs de la cola 'process-invoice'
    ProcessInvoiceWorker,
  ],
})
export class JobsModule {}
