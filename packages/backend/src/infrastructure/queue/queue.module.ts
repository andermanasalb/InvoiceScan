import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  InvoiceQueueService,
  PROCESS_INVOICE_QUEUE,
} from './invoice-queue.service';
import {
  ExportQueueService,
  EXPORT_INVOICE_QUEUE,
} from './export-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: PROCESS_INVOICE_QUEUE }),
    BullModule.registerQueue({ name: EXPORT_INVOICE_QUEUE }),
  ],
  providers: [InvoiceQueueService, ExportQueueService],
  exports: [InvoiceQueueService, ExportQueueService],
})
export class QueueModule {}
