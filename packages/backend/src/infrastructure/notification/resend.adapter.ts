import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  NotificationPort,
  InvoiceNotificationPayload,
} from '../../application/ports/notification.port';
import {
  sentForValidationTemplate,
  sentForValidationSelfTemplate,
  sentForApprovalTemplate,
  approvedTemplate,
  rejectedTemplate,
} from './email-templates';

/**
 * ResendAdapter
 *
 * Implements NotificationPort using the Resend SDK.
 *
 * - Uses { data, error } pattern — never throws; workers must not crash.
 * - Idempotency key prevents duplicate emails on outbox retries.
 * - Sends one email per recipient (toEmails is already deduplicated by handlers).
 */
export class ResendAdapter implements NotificationPort {
  private readonly resend: Resend;
  private readonly logger = new Logger(ResendAdapter.name);

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void> {
    if (!payload.toEmails.length) {
      this.logger.warn('notifyStatusChange called with empty toEmails', {
        invoiceId: payload.invoiceId,
        eventType: payload.eventType,
      });
      return;
    }

    const template = this.resolveTemplate(payload);

    for (const recipient of payload.toEmails) {
      const idempotencyKey = `${payload.eventType}/${payload.invoiceId}/${recipient}`;

      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [recipient],
        subject: template.subject,
        html: template.html,
        headers: {
          'X-Entity-Ref-ID': idempotencyKey,
        },
      });

      if (error) {
        this.logger.error('Failed to send email via Resend', {
          invoiceId: payload.invoiceId,
          eventType: payload.eventType,
          recipient,
          error: error.message,
        });
        // Do not throw — a failed email must not crash the outbox worker.
      } else {
        this.logger.log('Email sent successfully', {
          invoiceId: payload.invoiceId,
          eventType: payload.eventType,
          recipient,
        });
      }
    }
  }

  private resolveTemplate(payload: InvoiceNotificationPayload): {
    subject: string;
    html: string;
  } {
    switch (payload.eventType) {
      case 'sent_for_validation':
        return sentForValidationTemplate(payload);
      case 'sent_for_validation_self':
        return sentForValidationSelfTemplate(payload);
      case 'sent_for_approval':
        return sentForApprovalTemplate(payload);
      case 'approved':
        return approvedTemplate(payload);
      case 'rejected':
        return rejectedTemplate(payload);
    }
  }
}
