import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPort,
  InvoiceNotificationPayload,
} from '../../application/ports/notification.port';

export const NOTIFICATION_TOKEN = 'NOTIFICATION_TOKEN';

/**
 * NoOpNotificationAdapter
 *
 * Placeholder implementation of NotificationPort that simply logs the
 * notification payload. No real email is sent.
 *
 * FASE 11 will replace this with a NodemailerAdapter that sends actual emails
 * via the InvoiceApprovedHandler / InvoiceRejectedHandler (EventEmitter2).
 * Neither use cases nor controllers need to change when that swap happens.
 */
@Injectable()
export class NoOpNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(NoOpNotificationAdapter.name);

  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void> {
    this.logger.log('Notification (no-op)', {
      invoiceId: payload.invoiceId,
      status: payload.status,
    });
    return Promise.resolve();
  }
}
