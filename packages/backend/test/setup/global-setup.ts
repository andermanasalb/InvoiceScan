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
// Import migration classes directly — glob strings cause TypeORM to use require() which
// fails in Vitest's ESM context (same reason entities are imported directly above).
import { CreateUsersTable1741650001000 } from '../../src/infrastructure/db/migrations/1741650001000-CreateUsersTable';
import { CreateUserCredentialsTable1741650002000 } from '../../src/infrastructure/db/migrations/1741650002000-CreateUserCredentialsTable';
import { CreateProvidersTable1741650003000 } from '../../src/infrastructure/db/migrations/1741650003000-CreateProvidersTable';
import { CreateInvoicesTable1741650004000 } from '../../src/infrastructure/db/migrations/1741650004000-CreateInvoicesTable';
import { CreateInvoiceEventsTable1741650005000 } from '../../src/infrastructure/db/migrations/1741650005000-CreateInvoiceEventsTable';
import { CreateAuditEventsTable1741650006000 } from '../../src/infrastructure/db/migrations/1741650006000-CreateAuditEventsTable';
import { CreateOutboxEventsTable1741650007000 } from '../../src/infrastructure/db/migrations/1741650007000-CreateOutboxEventsTable';
import { CreateInvoiceNotesTable1741650008000 } from '../../src/infrastructure/db/migrations/1741650008000-CreateInvoiceNotesTable';
import { AddValidatorIdToInvoices1741650009000 } from '../../src/infrastructure/db/migrations/1741650009000-AddValidatorIdToInvoices';
import { CreateUserAssignmentsTable1741900000000 } from '../../src/infrastructure/db/migrations/1741900000000-CreateUserAssignmentsTable';

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
      CreateUsersTable1741650001000,
      CreateUserCredentialsTable1741650002000,
      CreateProvidersTable1741650003000,
      CreateInvoicesTable1741650004000,
      CreateInvoiceEventsTable1741650005000,
      CreateAuditEventsTable1741650006000,
      CreateOutboxEventsTable1741650007000,
      CreateInvoiceNotesTable1741650008000,
      AddValidatorIdToInvoices1741650009000,
      CreateUserAssignmentsTable1741900000000,
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
