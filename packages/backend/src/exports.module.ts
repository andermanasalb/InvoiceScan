import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './infrastructure/db/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { EXPORT_INVOICE_QUEUE } from './infrastructure/queue/export-queue.service';
import { ExportQueueService } from './infrastructure/queue/export-queue.service';
import { ExportInvoicesUseCase } from './application/use-cases/export-invoices.use-case';
import {
  ExportsController,
  EXPORT_INVOICES_USE_CASE_TOKEN,
} from './interface/http/controllers/exports.controller';
import type { ExportQueuePort } from './application/ports/export-queue.port';

/**
 * ExportsModule
 *
 * Wires the export feature:
 *   ExportsController → ExportInvoicesUseCase → ExportQueueService → BullMQ queue
 *
 * The ExportInvoicesWorker lives in JobsModule (alongside ProcessInvoiceWorker).
 * The BullModule.registerQueue here provides the Queue instance for job status polling.
 */
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    // Re-register the queue so @InjectQueue works in this module's controller
    BullModule.registerQueue({ name: EXPORT_INVOICE_QUEUE }),
  ],
  controllers: [ExportsController],
  providers: [
    {
      provide: EXPORT_INVOICES_USE_CASE_TOKEN,
      useFactory: (exportQueue: ExportQueuePort) =>
        new ExportInvoicesUseCase(exportQueue),
      inject: [ExportQueueService],
    },
  ],
})
export class ExportsModule {}
