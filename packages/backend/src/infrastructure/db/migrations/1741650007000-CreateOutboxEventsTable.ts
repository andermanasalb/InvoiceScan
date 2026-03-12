import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateOutboxEventsTable
 *
 * Crea la tabla outbox_events para el patrón Transactional Outbox.
 * Garantiza at-least-once delivery de domain events aunque la app se caiga
 * entre el save del aggregate y la publicación del evento.
 *
 * Índice parcial sobre processed = false: el OutboxPollerWorker solo lee
 * eventos pendientes, así que el índice es muy selectivo y extremadamente
 * eficiente conforme crezca la tabla.
 */
export class CreateOutboxEventsTable1741650007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id            UUID        NOT NULL,
        event_type    VARCHAR(100) NOT NULL,
        payload       JSONB       NOT NULL,
        processed     BOOLEAN     NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at  TIMESTAMPTZ NULL,
        CONSTRAINT pk_outbox_events PRIMARY KEY (id)
      )
    `);

    // Índice parcial: solo las filas no procesadas.
    // Cuando processed = true la fila deja de aparecer en el índice.
    await queryRunner.query(`
      CREATE INDEX idx_outbox_events_unprocessed
        ON outbox_events (created_at ASC)
        WHERE processed = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_outbox_events_unprocessed`);
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_events`);
  }
}
