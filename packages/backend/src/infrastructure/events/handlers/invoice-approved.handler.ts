import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceApprovedEvent } from '../../../domain/events/invoice-approved.event';
import type { NotificationPort } from '../../../application/ports/notification.port';

export const NOTIFICATION_TOKEN = 'NOTIFICATION_TOKEN';

/**
 * InvoiceApprovedHandler
 *
 * Listens to the 'invoice.approved' event emitted by OutboxPollerWorker.
 *
 * FASE 9: no-op (just logs).
 * FASE 11: NotificationModule swaps NoOpNotificationAdapter → NodemailerAdapter.
 *           This handler stays identical — only the injected implementation changes.
 */
@Injectable()
export class InvoiceApprovedHandler {
  private readonly logger = new Logger(InvoiceApprovedHandler.name);

  constructor(
    @Inject(NOTIFICATION_TOKEN)
    private readonly notifier: NotificationPort,
  ) {}

  @OnEvent('invoice.approved', { async: true })
  async handle(event: InvoiceApprovedEvent): Promise<void> {
    this.logger.log('invoice.approved received', {
      invoiceId: event.payload.invoiceId,
      approverId: event.payload.approverId,
      status: event.payload.status,
    });

    await this.notifier.notifyStatusChange({
      invoiceId: event.payload.invoiceId,
      status: event.payload.status,
    });
  }
}
