import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProvidersTable1741650003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE providers (
        id           UUID         NOT NULL,
        name         VARCHAR(100) NOT NULL,
        adapter_type VARCHAR(100) NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT pk_providers PRIMARY KEY (id),
        CONSTRAINT uq_providers_name UNIQUE (name)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS providers`);
  }
}
