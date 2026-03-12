import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceRejectedEvent } from '../../../domain/events/invoice-rejected.event';

/**
 * InvoiceRejectedHandler
 *
 * Escucha el evento 'invoice.rejected' emitido por el OutboxPollerWorker.
 *
 * FASE 9 (ahora): solo loguea — no-op.
 * FASE 11: aquí se llamará a NodemailerAdapter para notificar al proveedor
 * con el motivo del rechazo, sin tocar use cases ni controllers.
 */
@Injectable()
export class InvoiceRejectedHandler {
  private readonly logger = new Logger(InvoiceRejectedHandler.name);

  @OnEvent('invoice.rejected', { async: true })
  async handle(event: InvoiceRejectedEvent): Promise<void> {
    this.logger.log('invoice.rejected recibido (no-op)', {
      invoiceId: event.payload.invoiceId,
      approverId: event.payload.approverId,
      reason: event.payload.reason,
      status: event.payload.status,
    });
  }
}
