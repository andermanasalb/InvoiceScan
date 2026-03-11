import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1741650001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id         UUID         NOT NULL,
        email      VARCHAR(255) NOT NULL,
        role       VARCHAR(50)  NOT NULL,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT uq_users_email UNIQUE (email)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_email ON users(email)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_email`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
