import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserCredentialOrmEntity } from '../entities/user-credential.orm-entity';
import { ProviderOrmEntity } from '../entities/provider.orm-entity';
import { InvoiceOrmEntity } from '../entities/invoice.orm-entity';
import { InvoiceEventOrmEntity } from '../entities/invoice-event.orm-entity';
import { AuditEventOrmEntity } from '../entities/audit-event.orm-entity';

// process.cwd() in Vitest is the package root (packages/backend/).
// The monorepo root .env is two levels up from there.
dotenv.config({ path: join(process.cwd(), '../../.env') });

/**
 * Creates a real TypeORM DataSource connected to the test database.
 * Used exclusively by integration tests — never in production code.
 *
 * Each test suite calls createTestDataSource() in beforeAll() and
 * destroys it in afterAll() to avoid leaving open connections.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    // Import entity classes directly — glob strings require raw TS loading which fails at runtime
    entities: [
      UserOrmEntity,
      UserCredentialOrmEntity,
      ProviderOrmEntity,
      InvoiceOrmEntity,
      InvoiceEventOrmEntity,
      AuditEventOrmEntity,
    ],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

/**
 * Cleans all rows from the given tables in the correct order
 * (child tables first to respect foreign key constraints).
 * Called in beforeEach() so every test starts with a clean slate.
 */
export async function clearTables(ds: DataSource): Promise<void> {
  await ds.query('DELETE FROM audit_events');
  await ds.query('DELETE FROM invoice_events');
  await ds.query('DELETE FROM invoices');
  await ds.query('DELETE FROM user_credentials');
  await ds.query('DELETE FROM providers');
  await ds.query('DELETE FROM users');
}
