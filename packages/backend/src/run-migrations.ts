/**
 * run-migrations.ts
 *
 * Standalone migration runner for Docker / production.
 * Run with: node dist/run-migrations.js
 *
 * This script initialises a TypeORM DataSource pointing at the compiled
 * migration files in dist/, runs all pending migrations, then exits.
 * It does NOT start the NestJS application.
 *
 * Usage in Docker Compose:
 *   command: node dist/run-migrations.js
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Minimal dotenv support when running locally (Docker injects env directly)
import { config } from 'dotenv';
config({ path: join(__dirname, '../../.env') });

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('[run-migrations] ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    // In production the compiled JS entities live next to this file
    entities: [join(__dirname, 'infrastructure/db/entities/*.orm-entity.js')],
    migrations: [join(__dirname, 'infrastructure/db/migrations/*.js')],
    synchronize: false,
    logging: true,
  });

  try {
    await ds.initialize();
    console.log('[run-migrations] DataSource initialised.');

    const pending = await ds.showMigrations();
    if (!pending) {
      console.log('[run-migrations] No pending migrations. Nothing to do.');
    } else {
      const ran = await ds.runMigrations({ transaction: 'each' });
      console.log(`[run-migrations] Applied ${ran.length} migration(s).`);
      for (const m of ran) {
        console.log(`  ✓ ${m.name}`);
      }
    }

    await ds.destroy();
    console.log('[run-migrations] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[run-migrations] Migration failed:', err);
    await ds.destroy().catch(() => undefined);
    process.exit(1);
  }
}

void runMigrations();
