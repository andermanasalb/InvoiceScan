import { DomainEventBase } from '../../domain/events/domain-event.base.js';

/**
 * EventBusPort
 *
 * Interfaz que los use cases usan para publicar domain events.
 * La implementación concreta (OutboxEventBusAdapter) persiste el evento
 * en la tabla outbox_events para garantizar at-least-once delivery.
 *
 * Los use cases NUNCA saben cómo se publica el evento ni a dónde va.
 */
export interface EventBusPort {
  publish(event: DomainEventBase): Promise<void>;
}

export const EVENT_BUS_TOKEN = 'EVENT_BUS_TOKEN';
