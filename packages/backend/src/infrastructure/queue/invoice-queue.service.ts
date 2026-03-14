/**
 * InvoiceQueueService
 *
 * Implementación de InvoiceQueuePort usando BullMQ.
 * Encola jobs de procesamiento OCR en la cola 'process-invoice'.
 *
 * Idempotencia:
 * - enqueueProcessing usa jobId = invoiceId → BullMQ descarta duplicados.
 * - enqueueRetry usa jobId = invoiceId + timestamp → evita colisión con el
 *   job original que puede seguir en estado 'failed' con el mismo jobId.
 *
 * Configuración de reintentos: 3 intentos con backoff exponencial (2s base).
 */
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InvoiceQueuePort } from '../../application/ports/invoice-queue.port';

export const PROCESS_INVOICE_QUEUE = 'process-invoice';
export const INVOICE_QUEUE_SERVICE_TOKEN = 'InvoiceQueueService';

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
