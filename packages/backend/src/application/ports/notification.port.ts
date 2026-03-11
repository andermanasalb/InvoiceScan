export interface InvoiceNotificationPayload {
  invoiceId: string;
  status: string;
  recipientEmail: string;
  recipientName: string;
  providerName?: string;
  notes?: string;
}

export interface NotificationPort {
  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void>;
}
