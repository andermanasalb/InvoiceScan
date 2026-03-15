export type NotificationEventType =
  | 'sent_for_validation'
  | 'sent_for_validation_self'
  | 'sent_for_approval'
  | 'approved'
  | 'rejected';

export interface InvoiceNotificationPayload {
  eventType: NotificationEventType;
  invoiceId: string;
  /** Deduplicated list of recipient email addresses. */
  toEmails: string[];
  invoiceNumber?: string;
  vendorName?: string;
  amount?: number;
  /** Email of whoever triggered the action (shown in email body). */
  actorEmail?: string;
  /** Most recent note content, if any note exists. */
  latestNote?: string;
  /** Mandatory on 'rejected' events. */
  rejectionReason?: string;
}

export interface NotificationPort {
  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void>;
}
