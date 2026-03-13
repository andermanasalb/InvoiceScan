import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const PROCESS_INVOICE_QUEUE = 'process-invoice';
export const INVOICE_QUEUE_SERVICE_TOKEN = 'InvoiceQueueService';

export interface InvoiceQueuePort {
  enqueueProcessing(invoiceId: string): Promise<void>;
  enqueueRetry(invoiceId: string): Promise<void>;
}

@Injectable()
export class InvoiceQueueService implements InvoiceQueuePort {
  constructor(
    @InjectQueue(PROCESS_INVOICE_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Encola el procesamiento OCR de una factura.
   *
   * jobId = invoiceId garantiza idempotencia: si el mismo job
   * se encola dos veces, BullMQ ignora el duplicado.
   */
  async enqueueProcessing(invoiceId: string): Promise<void> {
    await this.queue.add(
      'process',
      { invoiceId },
      {
        jobId: invoiceId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  /**
   * Re-encola el procesamiento de una factura tras un reintento manual.
   *
   * Usa un jobId diferente al original (invoiceId + timestamp) para evitar
   * que BullMQ lo descarte por duplicado (el job original puede haber fallado
   * con jobId = invoiceId, que BullMQ mantiene en failed con ese mismo id).
   */
  async enqueueRetry(invoiceId: string): Promise<void> {
    await this.queue.add(
      'process',
      { invoiceId },
      {
        jobId: `${invoiceId}-retry-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
