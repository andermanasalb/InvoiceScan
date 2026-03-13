import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceNotesTable1741650008000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invoice_notes (
        id          UUID        NOT NULL,
        invoice_id  UUID        NOT NULL,
        author_id   UUID        NOT NULL,
        content     TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL,
        CONSTRAINT pk_invoice_notes PRIMARY KEY (id),
        CONSTRAINT fk_invoice_notes_invoice FOREIGN KEY (invoice_id)
          REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoice_notes_invoice_id ON invoice_notes(invoice_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoice_notes_invoice_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_notes`);
  }
}
