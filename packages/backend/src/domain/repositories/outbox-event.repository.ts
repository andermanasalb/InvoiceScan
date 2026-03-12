import { DomainEventBase } from '../events/domain-event.base.js';

/**
 * Registro de un evento en la tabla outbox_events tal como lo devuelve la DB.
 */
export interface OutboxEventRecord {
  id: string;
  eventType: string;
  payload: unknown;
  processed: boolean;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * OutboxEventRepository
 *
 * Interfaz de dominio para el patrón Transactional Outbox.
 * La implementación concreta (OutboxEventTypeOrmRepository) escribe y lee
 * de la tabla outbox_events en PostgreSQL.
 *
 * Regla: esta interfaz vive en domain/repositories — sin imports de TypeORM.
 */
export interface OutboxEventRepository {
  /**
   * Persiste un domain event serializado como registro outbox pendiente.
   * Llamado desde OutboxEventBusAdapter justo después de invoiceRepo.save().
   */
  save(event: DomainEventBase): Promise<void>;

  /**
   * Devuelve todos los eventos aún no procesados, ordenados por created_at ASC.
   * Llamado por OutboxPollerWorker cada 10s.
   */
  findUnprocessed(): Promise<OutboxEventRecord[]>;

  /**
   * Marca un evento como procesado (processed = true, processed_at = now).
   * Llamado por OutboxPollerWorker tras publicar el evento en el EventEmitter.
   */
  markProcessed(id: string): Promise<void>;
}

export const OUTBOX_EVENT_REPOSITORY = 'OutboxEventRepository';
