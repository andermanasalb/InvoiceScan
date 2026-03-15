import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPort,
  InvoiceNotificationPayload,
} from '../../application/ports/notification.port';

/**
 * NoOpNotificationAdapter
 *
 * Placeholder implementation of NotificationPort that simply logs the
 * notification payload. No real email is sent.
 *
 * Kept as a fallback / test double. Production uses ResendAdapter.
 */
@Injectable()
export class NoOpNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(NoOpNotificationAdapter.name);

  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void> {
    this.logger.log('Notification (no-op)', {
      invoiceId: payload.invoiceId,
      eventType: payload.eventType,
      toEmails: payload.toEmails,
    });
    return Promise.resolve();
  }
}
