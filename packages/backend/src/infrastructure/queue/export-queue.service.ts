import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import type {
  ExportJobOptions,
  ExportQueuePort,
} from '../../application/ports/export-queue.port';

export const EXPORT_INVOICE_QUEUE = 'export-invoices';
export const EXPORT_QUEUE_SERVICE_TOKEN = 'ExportQueueService';

@Injectable()
export class ExportQueueService implements ExportQueuePort {
  constructor(
    @InjectQueue(EXPORT_INVOICE_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueExport(options: ExportJobOptions): Promise<string> {
    const jobId = randomUUID();
    await this.queue.add(
      'export',
      { ...options, jobId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );
    return jobId;
  }
}
