import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceApprovedEvent } from '../../../domain/events/invoice-approved.event';

/**
 * InvoiceApprovedHandler
 *
 * Escucha el evento 'invoice.approved' emitido por el OutboxPollerWorker.
 *
 * FASE 9 (ahora): solo loguea — no-op.
 * FASE 11: aquí se llamará a NodemailerAdapter para enviar el email de
 * confirmación al proveedor y al aprobador, sin tocar use cases ni controllers.
 */
@Injectable()
export class InvoiceApprovedHandler {
  private readonly logger = new Logger(InvoiceApprovedHandler.name);

  @OnEvent('invoice.approved', { async: true })
  handle(event: InvoiceApprovedEvent): Promise<void> {
    this.logger.log('invoice.approved recibido (no-op)', {
      invoiceId: event.payload.invoiceId,
      approverId: event.payload.approverId,
      status: event.payload.status,
    });
    return Promise.resolve();
  }
}
