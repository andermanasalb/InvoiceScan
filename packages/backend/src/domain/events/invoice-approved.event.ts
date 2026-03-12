import { DomainEventBase } from './domain-event.base.js';

export interface InvoiceApprovedPayload {
  invoiceId: string;
  approverId: string;
  status: string;
}

export class InvoiceApprovedEvent extends DomainEventBase {
  declare readonly payload: InvoiceApprovedPayload;

  constructor(payload: InvoiceApprovedPayload) {
    super('invoice.approved', payload);
  }
}
