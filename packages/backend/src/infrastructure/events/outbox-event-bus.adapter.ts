import { Injectable, Inject, Logger } from '@nestjs/common';
import type { EventBusPort } from '../../application/ports/event-bus.port.js';
import type { DomainEventBase } from '../../domain/events/domain-event.base.js';
import type { OutboxEventRepository } from '../../domain/repositories/outbox-event.repository.js';
import { OUTBOX_EVENT_REPOSITORY } from '../../domain/repositories/outbox-event.repository.js';

/**
 * OutboxEventBusAdapter
 *
 * Implementación de EventBusPort que persiste el evento en outbox_events
 * en lugar de publicarlo directamente en el EventEmitter.
 *
 * ¿Por qué? Garantía at-least-once delivery:
 *   Si la app se cae después de guardar la factura pero antes de publicar
 *   el evento, el OutboxPollerWorker (Bloque 3b) lo recogerá y lo publicará.
 *
 * El flujo completo es:
 *   1. UseCase llama eventBus.publish(event)
 *   2. Este adapter guarda el evento en outbox_events (processed = false)
 *   3. OutboxPollerWorker lee los eventos no procesados cada 10s
 *   4. Publica en EventEmitter2 → handler no-op (ahora) o Nodemailer (FASE 11)
 *   5. Marca el evento como processed = true
 */
@Injectable()
export class OutboxEventBusAdapter implements EventBusPort {
  private readonly logger = new Logger(OutboxEventBusAdapter.name);

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxRepo: OutboxEventRepository,
  ) {}

  async publish(event: DomainEventBase): Promise<void> {
    await this.outboxRepo.save(event);
    this.logger.log(`Outbox event queued: ${event.eventType}`, {
      eventType: event.eventType,
      occurredAt: event.occurredAt,
    });
  }
}
