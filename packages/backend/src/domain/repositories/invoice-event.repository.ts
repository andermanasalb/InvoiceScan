import { InvoiceEvent } from '../entities';

export const INVOICE_EVENT_REPOSITORY = 'InvoiceEventRepository';

export interface InvoiceEventRepository {
  findByInvoiceId(invoiceId: string): Promise<InvoiceEvent[]>;
  save(event: InvoiceEvent): Promise<void>;
}
