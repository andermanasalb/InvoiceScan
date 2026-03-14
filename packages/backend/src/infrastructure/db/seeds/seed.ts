/**
 * Seed script — crea los 4 usuarios de demo si no existen.
 * Idempotente: se puede ejecutar múltiples veces sin duplicar registros.
 *
 * Uso:
 *   pnpm --filter backend seed
 */

import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';

// seed.ts se ejecuta con ts-node desde packages/backend/
// __dirname = packages/backend/src/infrastructure/db/seeds
// → 6 niveles arriba = raíz del monorepo
dotenv.config({ path: join(__dirname, '../../../../../../.env') });

const BCRYPT_ROUNDS = 12;

// UUID fijo para el provider generic — el frontend lo usa hardcodeado
const GENERIC_PROVIDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const SEED_USERS = [
  {
    email: 'admin@invoicescan.com',
    password: 'Admin1234!',
    role: 'admin',
  },
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

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [join(__dirname, '../entities/*.orm-entity.{ts,js}')],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const seedUser of SEED_USERS) {
    // Comprobar si ya existe
    const existing = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM users WHERE email = $1`,
      [seedUser.email],
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const userId = randomUUID();
    const credentialId = randomUUID();
    const passwordHash = await bcrypt.hash(seedUser.password, BCRYPT_ROUNDS);

    // Insertar usuario
    await dataSource.query(
      `INSERT INTO users (id, email, role, created_at) VALUES ($1, $2, $3, $4)`,
      [userId, seedUser.email, seedUser.role, now],
    );

    // Insertar credencial
    await dataSource.query(
      `INSERT INTO user_credentials (id, user_id, password_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [credentialId, userId, passwordHash, now],
    );

    created++;
  }

  // ─── Seed providers ───────────────────────────────────────────────────────
  const existingProvider = await dataSource.query<{ id: string }[]>(
    `SELECT id FROM providers WHERE id = $1`,
    [GENERIC_PROVIDER_ID],
  );

  if (existingProvider.length === 0) {
    await dataSource.query(
      `INSERT INTO providers (id, name, adapter_type, created_at) VALUES ($1, $2, $3, $4)`,
      [GENERIC_PROVIDER_ID, 'Generic (AI-powered)', 'generic', now],
    );
    console.log('✅ Provider generic creado.');
  } else {
    console.log('ℹ️  Provider generic ya existía.');
  }

  await dataSource.destroy();

  // Output
  console.log('');
  if (created === 0 && skipped === SEED_USERS.length) {
    console.log(
      'ℹ️  Todos los usuarios de seed ya existían. No se creó ninguno.',
    );
  } else {
    console.log(
      `✅ Seed completado — ${created} usuario(s) creado(s), ${skipped} ya existían.`,
    );
  }

  console.log('');
  console.log('┌─────────────────────────────┬──────────────────┬───────────┐');
  console.log('│ Email                       │ Password         │ Rol       │');
  console.log('├─────────────────────────────┼──────────────────┼───────────┤');
  for (const u of SEED_USERS) {
    const email = u.email.padEnd(27);
    const pass = u.password.padEnd(16);
    const role = u.role.padEnd(9);
    console.log(`│ ${email} │ ${pass} │ ${role} │`);
  }
  console.log('└─────────────────────────────┴──────────────────┴───────────┘');
  console.log('');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Error durante el seed:', message);
    process.exit(1);
  });
