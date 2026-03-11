import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceEventsTable1741650005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invoice_events (
        id          UUID        NOT NULL,
        invoice_id  UUID        NOT NULL,
        from_status VARCHAR(50) NOT NULL,
        to_status   VARCHAR(50) NOT NULL,
        user_id     UUID        NOT NULL,
        timestamp   TIMESTAMPTZ NOT NULL,
        CONSTRAINT pk_invoice_events PRIMARY KEY (id),
        CONSTRAINT fk_invoice_events_invoice FOREIGN KEY (invoice_id)
          REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoice_events_invoice_id ON invoice_events(invoice_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoice_events_invoice_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_events`);
  }
}
