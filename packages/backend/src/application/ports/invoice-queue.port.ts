/**
 * InvoiceQueuePort — contrato del servicio de colas de facturas.
 *
 * Define la interfaz que la capa de aplicación necesita para encolar jobs
 * de procesamiento OCR sin acoplarse a BullMQ ni a ninguna otra tecnología
 * de colas. La implementación concreta es InvoiceQueueService en infrastructure/queue/.
 *
 * Principio de Inversión de Dependencias (DIP):
 * - UploadInvoiceUseCase y RetryInvoiceUseCase dependen de este puerto.
 * - InvoiceQueueService implementa este puerto.
 * - El módulo NestJS (invoices.module.ts) conecta ambos en tiempo de ejecución.
 */
export interface InvoiceQueuePort {
  /** Encola el job de OCR para una factura recién subida. */
  enqueueProcessing(invoiceId: string): Promise<void>;
  /** Re-encola el job de una factura que falló en validación (retry manual). */
  enqueueRetry(invoiceId: string): Promise<void>;
}

/** Token de inyección para InvoiceQueuePort en el contenedor de NestJS. */
export const INVOICE_QUEUE_PORT_TOKEN = 'InvoiceQueuePort';
