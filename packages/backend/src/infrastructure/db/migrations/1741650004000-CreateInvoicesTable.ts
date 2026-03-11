import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoicesTable1741650004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invoices (
        id                UUID          NOT NULL,
        provider_id       UUID          NOT NULL,
        uploader_id       UUID          NOT NULL,
        file_path         VARCHAR(500)  NOT NULL,
        amount            NUMERIC(12,2) NOT NULL,
        date              DATE          NOT NULL,
        status            VARCHAR(50)   NOT NULL,
        extracted_data    JSONB,
        validation_errors TEXT[]        NOT NULL DEFAULT '{}',
        approver_id       UUID,
        rejection_reason  TEXT,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT pk_invoices PRIMARY KEY (id),
        CONSTRAINT fk_invoices_provider FOREIGN KEY (provider_id)
          REFERENCES providers(id),
        CONSTRAINT fk_invoices_uploader FOREIGN KEY (uploader_id)
          REFERENCES users(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoices_status ON invoices(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_invoices_uploader_id ON invoices(uploader_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_invoices_created_at ON invoices(created_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_uploader_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoices`);
  }
}
