import { DomainEventBase } from './domain-event.base.js';

export interface InvoiceRejectedPayload {
  invoiceId: string;
  approverId: string;
  reason: string;
  status: string;
}

export class InvoiceRejectedEvent extends DomainEventBase {
  declare readonly payload: InvoiceRejectedPayload;

  constructor(payload: InvoiceRejectedPayload) {
    super('invoice.rejected', payload);
  }
}
