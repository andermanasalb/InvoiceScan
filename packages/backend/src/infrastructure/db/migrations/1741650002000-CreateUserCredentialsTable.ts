import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserCredentialsTable1741650002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_credentials (
        id            UUID         NOT NULL,
        user_id       UUID         NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT pk_user_credentials PRIMARY KEY (id),
        CONSTRAINT uq_user_credentials_user_id UNIQUE (user_id),
        CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_credentials`);
  }
}
