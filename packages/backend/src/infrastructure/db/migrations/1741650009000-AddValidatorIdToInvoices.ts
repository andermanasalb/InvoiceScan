import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the validator_id column to the invoices table.
 *
 * This supports the new READY_FOR_VALIDATION state: when a validator (or
 * approver/admin) moves an invoice from EXTRACTED → READY_FOR_VALIDATION,
 * their user id is recorded here.  The send-to-approval use case then
 * checks that the same person cannot also move it to READY_FOR_APPROVAL
 * (cross-ownership restriction).
 *
 * The status column is VARCHAR(50), so no enum change is required in
 * Postgres — the new 'READY_FOR_VALIDATION' value is simply a new string.
 */
export class AddValidatorIdToInvoices1741650009000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS validator_id UUID REFERENCES users(id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices
        DROP COLUMN IF EXISTS validator_id
    `);
  }
}
