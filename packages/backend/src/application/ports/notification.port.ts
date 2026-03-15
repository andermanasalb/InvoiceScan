export interface InvoiceNotificationPayload {
  invoiceId: string;
  status: string;
  /** Email resolved by FASE 11's NodemailerAdapter; optional until then. */
  recipientEmail?: string;
  recipientName?: string;
  providerName?: string;
  notes?: string;
}

export interface NotificationPort {
  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void>;
}
