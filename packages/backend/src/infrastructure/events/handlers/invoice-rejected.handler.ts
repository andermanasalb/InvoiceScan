import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceRejectedEvent } from '../../../domain/events/invoice-rejected.event';
import type { NotificationPort } from '../../../application/ports/notification.port';
import { NOTIFICATION_TOKEN } from './invoice-approved.handler';

/**
 * InvoiceRejectedHandler
 *
 * Listens to the 'invoice.rejected' event emitted by OutboxPollerWorker.
 *
 * FASE 9: no-op (just logs).
 * FASE 11: NotificationModule swaps NoOpNotificationAdapter → NodemailerAdapter.
 *           This handler stays identical — only the injected implementation changes.
 */
@Injectable()
export class InvoiceRejectedHandler {
  private readonly logger = new Logger(InvoiceRejectedHandler.name);

  constructor(
    @Inject(NOTIFICATION_TOKEN)
    private readonly notifier: NotificationPort,
  ) {}

  @OnEvent('invoice.rejected', { async: true })
  async handle(event: InvoiceRejectedEvent): Promise<void> {
    this.logger.log('invoice.rejected received', {
      invoiceId: event.payload.invoiceId,
      approverId: event.payload.approverId,
      reason: event.payload.reason,
      status: event.payload.status,
    });

    await this.notifier.notifyStatusChange({
      invoiceId: event.payload.invoiceId,
      status: event.payload.status,
      notes: event.payload.reason,
    });
  }
}
