import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEventsTable1741650006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_events (
        id          UUID         NOT NULL,
        user_id     UUID         NOT NULL,
        action      VARCHAR(100) NOT NULL,
        resource_id UUID         NOT NULL,
        ip          VARCHAR(45)  NOT NULL,
        timestamp   TIMESTAMPTZ  NOT NULL,
        CONSTRAINT pk_audit_events PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_events_user_id ON audit_events(user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_events_timestamp`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_events_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_events`);
  }
}
