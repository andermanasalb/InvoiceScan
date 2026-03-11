import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { STORAGE_TOKEN } from './infrastructure/storage/local-storage.adapter';
import { NoOpAuditAdapter, AUDIT_TOKEN } from './infrastructure/audit/no-op-audit.adapter';
import { UploadInvoiceUseCase } from './application/use-cases/upload-invoice.use-case';
import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
} from './interface/http/controllers/invoices.controller';
import type { InvoiceRepository } from './domain/repositories';
import type { StoragePort } from './application/ports/storage.port';
import type { AuditPort } from './application/ports/audit.port';

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
 *
 * The use case is registered under UPLOAD_INVOICE_USE_CASE_TOKEN so the
 * controller can inject it without depending on the concrete class directly.
 */
@Module({
  imports: [DatabaseModule, StorageModule],
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
      ) => new UploadInvoiceUseCase(invoiceRepo, storage, auditor),
      inject: ['InvoiceRepository', STORAGE_TOKEN, AUDIT_TOKEN],
    },
  ],
})
export class InvoicesModule {}
