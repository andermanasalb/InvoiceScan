import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates two assignment tables that model the reviewer hierarchy:
 *
 *   uploader_validator_assignments
 *     Each uploader can be assigned to exactly ONE validator.
 *     One validator can have MANY uploaders.
 *
 *   validator_approver_assignments
 *     Each validator can be assigned to exactly ONE approver.
 *     One approver can have MANY validators.
 *
 * Both tables record who created the assignment (always an admin).
 */
export class CreateUserAssignmentsTable1741900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "uploader_validator_assignments" (
        "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
        "uploader_id"  UUID        NOT NULL,
        "validator_id" UUID        NOT NULL,
        "created_by"   UUID        NOT NULL,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_uva" PRIMARY KEY ("id"),
        CONSTRAINT "uq_uva_uploader" UNIQUE ("uploader_id"),
        CONSTRAINT "fk_uva_uploader"  FOREIGN KEY ("uploader_id")  REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_uva_validator" FOREIGN KEY ("validator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_uva_created"   FOREIGN KEY ("created_by")   REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_uva_validator_id" ON "uploader_validator_assignments"("validator_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "validator_approver_assignments" (
        "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
        "validator_id" UUID        NOT NULL,
        "approver_id"  UUID        NOT NULL,
        "created_by"   UUID        NOT NULL,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_vaa" PRIMARY KEY ("id"),
        CONSTRAINT "uq_vaa_validator" UNIQUE ("validator_id"),
        CONSTRAINT "fk_vaa_validator" FOREIGN KEY ("validator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_vaa_approver"  FOREIGN KEY ("approver_id")  REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_vaa_created"   FOREIGN KEY ("created_by")   REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_vaa_approver_id" ON "validator_approver_assignments"("approver_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_vaa_approver_id"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "validator_approver_assignments"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_uva_validator_id"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "uploader_validator_assignments"`,
    );
  }
}
