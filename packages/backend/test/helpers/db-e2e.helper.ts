/**
 * db-e2e.helper.ts
 *
 * Utilities for cleaning the test database between E2E spec files.
 * Tables are deleted in the correct order to respect foreign key constraints.
 *
 * Call clearAllTables() in afterAll() (or beforeAll()) of each E2E spec.
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

export async function clearAllTables(app: INestApplication): Promise<void> {
  const ds = app.get<DataSource>(getDataSourceToken());

  // Delete in FK-safe order: children before parents
  await ds.query('DELETE FROM outbox_events');
  await ds.query('DELETE FROM invoice_notes');
  await ds.query('DELETE FROM audit_events');
  await ds.query('DELETE FROM invoice_events');
  await ds.query('DELETE FROM invoices');
  await ds.query('DELETE FROM uploader_validator_assignments');
  await ds.query('DELETE FROM validator_approver_assignments');
  await ds.query('DELETE FROM user_credentials');
  await ds.query('DELETE FROM providers');
  await ds.query('DELETE FROM users');
}
