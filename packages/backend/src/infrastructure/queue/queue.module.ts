import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  InvoiceQueueService,
  PROCESS_INVOICE_QUEUE,
} from './invoice-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PROCESS_INVOICE_QUEUE,
    }),
  ],
  providers: [InvoiceQueueService],
  exports: [InvoiceQueueService],
})
export class QueueModule {}
