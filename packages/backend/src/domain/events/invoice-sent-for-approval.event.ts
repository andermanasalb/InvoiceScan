import { DomainEventBase } from './domain-event.base.js';

export interface InvoiceSentForApprovalPayload {
  invoiceId: string;
  sentById: string; // the person who clicked "Send to Approval"
  status: string;
}

export class InvoiceSentForApprovalEvent extends DomainEventBase {
  declare readonly payload: InvoiceSentForApprovalPayload;

  constructor(payload: InvoiceSentForApprovalPayload) {
    super('invoice.sent_for_approval', payload);
  }
}
