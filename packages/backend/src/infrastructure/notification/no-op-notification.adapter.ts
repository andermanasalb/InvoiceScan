import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
  constructor(
    @InjectPinoLogger(NoOpNotificationAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void> {
    this.logger.info(
      {
        invoiceId: payload.invoiceId,
        eventType: payload.eventType,
        toEmails: payload.toEmails,
      },
      'Notification (no-op)',
    );
    return Promise.resolve();
  }
}
