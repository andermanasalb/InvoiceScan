import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * OutboxEventOrmEntity
 *
 * Representa un registro en la tabla outbox_events.
 * Cada fila es un domain event pendiente de procesar.
 *
 * El campo payload es JSONB: permite queries eficientes sobre el contenido
 * del evento si en el futuro necesitamos filtrar por invoiceId, etc.
 */
@Entity('outbox_events')
export class OutboxEventOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
