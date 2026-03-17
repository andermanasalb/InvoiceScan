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
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

// Minimal dotenv support when running locally (Docker injects env directly)
import { config } from 'dotenv';
config({ path: join(__dirname, '../../.env') });

const GENERIC_PROVIDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEED_USERS = [
  { email: 'admin@invoicescan.com', password: 'Admin1234!', role: 'admin' },
  {
    email: 'approver@invoicescan.com',
    password: 'Approver1234!',
    role: 'approver',
  },
  {
    email: 'validator@invoicescan.com',
    password: 'Validator1234!',
    role: 'validator',
  },
  {
    email: 'uploader@invoicescan.com',
    password: 'Uploader1234!',
    role: 'uploader',
  },
];

async function runSeed(ds: DataSource): Promise<void> {
  const now = new Date();
  let created = 0;

  for (const seedUser of SEED_USERS) {
    const existing = await ds.query<{ id: string }[]>(
      `SELECT id FROM users WHERE email = $1`,
      [seedUser.email],
    );
    if (existing.length > 0) continue;

    const userId = randomUUID();
    const credentialId = randomUUID();
    const passwordHash = await bcrypt.hash(seedUser.password, 12);
    await ds.query(
      `INSERT INTO users (id, email, role, created_at) VALUES ($1, $2, $3, $4)`,
      [userId, seedUser.email, seedUser.role, now],
    );
    await ds.query(
      `INSERT INTO user_credentials (id, user_id, password_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [credentialId, userId, passwordHash, now],
    );
    created++;
  }

  const existingProvider = await ds.query<{ id: string }[]>(
    `SELECT id FROM providers WHERE id = $1`,
    [GENERIC_PROVIDER_ID],
  );
  if (existingProvider.length === 0) {
    await ds.query(
      `INSERT INTO providers (id, name, adapter_type, created_at) VALUES ($1, $2, $3, $4)`,
      [GENERIC_PROVIDER_ID, 'Generic (AI-powered)', 'generic', now],
    );
  }

  console.log(
    `[run-migrations] Seed: ${created} user(s) created, ${SEED_USERS.length - created} already existed.`,
  );
}

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

    await runSeed(ds);

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
