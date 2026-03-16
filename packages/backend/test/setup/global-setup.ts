/**
 * Vitest globalSetup — runs ONCE before all E2E spec files.
 *
 * Responsibilities:
 *   1. Load .env from the monorepo root.
 *   2. Run all pending TypeORM migrations on the test database.
 *
 * This is NOT a beforeAll() hook — it runs in a separate worker before any
 * test module is imported, so it can safely connect to the DB and run migrations
 * without interfering with NestJS bootstrap.
 */

import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { UserOrmEntity } from '../../src/infrastructure/db/entities/user.orm-entity';
import { UserCredentialOrmEntity } from '../../src/infrastructure/db/entities/user-credential.orm-entity';
import { ProviderOrmEntity } from '../../src/infrastructure/db/entities/provider.orm-entity';
import { InvoiceOrmEntity } from '../../src/infrastructure/db/entities/invoice.orm-entity';
import { InvoiceEventOrmEntity } from '../../src/infrastructure/db/entities/invoice-event.orm-entity';
import { AuditEventOrmEntity } from '../../src/infrastructure/db/entities/audit-event.orm-entity';
import { OutboxEventOrmEntity } from '../../src/infrastructure/db/entities/outbox-event.orm-entity';
import { InvoiceNoteOrmEntity } from '../../src/infrastructure/db/entities/invoice-note.orm-entity';
import { UploaderValidatorAssignmentOrmEntity } from '../../src/infrastructure/db/entities/uploader-validator-assignment.orm-entity';
import { ValidatorApproverAssignmentOrmEntity } from '../../src/infrastructure/db/entities/validator-approver-assignment.orm-entity';

// Load .env from monorepo root (process.cwd() = packages/backend/ when run via pnpm)
dotenv.config({ path: join(process.cwd(), '../../.env') });

export async function setup(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env['DATABASE_URL'],
    entities: [
      UserOrmEntity,
      UserCredentialOrmEntity,
      ProviderOrmEntity,
      InvoiceOrmEntity,
      InvoiceEventOrmEntity,
      AuditEventOrmEntity,
      OutboxEventOrmEntity,
      InvoiceNoteOrmEntity,
      UploaderValidatorAssignmentOrmEntity,
      ValidatorApproverAssignmentOrmEntity,
    ],
    migrations: [
      join(
        process.cwd(),
        'src/infrastructure/db/migrations/*.{ts,js}',
      ),
    ],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();

  console.log('[E2E global-setup] Migrations applied.');
}

export async function teardown(): Promise<void> {
  // Nothing to clean up at the global level.
  // Individual spec files drop their own data in afterAll().
}
