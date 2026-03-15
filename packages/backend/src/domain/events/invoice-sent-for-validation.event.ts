import { DomainEventBase } from './domain-event.base.js';

export interface InvoiceSentForValidationPayload {
  invoiceId: string;
  sentById: string; // the person who clicked "Send to Validation"
  status: string;
}

export class InvoiceSentForValidationEvent extends DomainEventBase {
  declare readonly payload: InvoiceSentForValidationPayload;

  constructor(payload: InvoiceSentForValidationPayload) {
    super('invoice.sent_for_validation', payload);
  }
}
