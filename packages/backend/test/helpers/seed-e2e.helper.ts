/**
 * seed-e2e.helper.ts
 *
 * Creates the four test users (uploader, validator, approver, admin) plus
 * a generic provider directly in the database via the NestJS app's DataSource.
 *
 * Uses bcrypt rounds=1 (instead of the production 12) for speed in tests.
 * Returns IDs and plain-text credentials so specs can log in via HTTP.
 *
 * Call seedE2EData() in beforeAll() of each E2E spec file after clearAllTables().
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

export const BCRYPT_TEST_ROUNDS = 1; // fast hashing — only for tests

export const TEST_PROVIDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export interface TestCredentials {
  email: string;
  password: string;
}

export interface SeededE2EData {
  adminId: string;
  approverId: string;
  validatorId: string;
  uploaderId: string;
  uploaderBId: string; // second uploader for RBAC tests
  adminCredentials: TestCredentials;
  approverCredentials: TestCredentials;
  validatorCredentials: TestCredentials;
  uploaderCredentials: TestCredentials;
  uploaderBCredentials: TestCredentials;
  providerId: string;
}

export async function seedE2EData(
  app: INestApplication,
): Promise<SeededE2EData> {
  const ds = app.get<DataSource>(getDataSourceToken());
  const now = new Date();

  const users: Array<{
    email: string;
    password: string;
    role: string;
    id: string;
  }> = [
    {
      email: 'e2e-admin@test.com',
      password: 'Admin1234!',
      role: 'admin',
      id: randomUUID(),
    },
    {
      email: 'e2e-approver@test.com',
      password: 'Approver1234!',
      role: 'approver',
      id: randomUUID(),
    },
    {
      email: 'e2e-validator@test.com',
      password: 'Validator1234!',
      role: 'validator',
      id: randomUUID(),
    },
    {
      email: 'e2e-uploader@test.com',
      password: 'Uploader1234!',
      role: 'uploader',
      id: randomUUID(),
    },
    {
      email: 'e2e-uploader-b@test.com',
      password: 'UploaderB1234!',
      role: 'uploader',
      id: randomUUID(),
    },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, BCRYPT_TEST_ROUNDS);
    const credId = randomUUID();

    await ds.query(
      `INSERT INTO users (id, email, role, created_at) VALUES ($1, $2, $3, $4)`,
      [u.id, u.email, u.role, now],
    );
    await ds.query(
      `INSERT INTO user_credentials (id, user_id, password_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [credId, u.id, hash, now],
    );
  }

  // Generic provider
  await ds.query(
    `INSERT INTO providers (id, name, adapter_type, created_at) VALUES ($1, $2, $3, $4)`,
    [TEST_PROVIDER_ID, 'Generic (E2E)', 'generic', now],
  );

  // Assignments: uploader→validator, uploaderB→validator, validator→approver
  // Required so the upload enforcement check passes in E2E tests
  const [adminUser, approverUser, validatorUser, uploaderUser, uploaderBUser] =
    users as typeof users;
  await ds.query(
    `INSERT INTO uploader_validator_assignments (id, uploader_id, validator_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), uploaderUser.id, validatorUser.id, adminUser.id, now],
  );
  await ds.query(
    `INSERT INTO uploader_validator_assignments (id, uploader_id, validator_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), uploaderBUser.id, validatorUser.id, adminUser.id, now],
  );
  await ds.query(
    `INSERT INTO validator_approver_assignments (id, validator_id, approver_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), validatorUser.id, approverUser.id, adminUser.id, now],
  );

  const [admin, approver, validator, uploader, uploaderB] = users as [
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
  ];

  return {
    adminId: admin.id,
    approverId: approver.id,
    validatorId: validator.id,
    uploaderId: uploader.id,
    uploaderBId: uploaderB.id,
    adminCredentials: { email: admin.email, password: admin.password },
    approverCredentials: { email: approver.email, password: approver.password },
    validatorCredentials: {
      email: validator.email,
      password: validator.password,
    },
    uploaderCredentials: { email: uploader.email, password: uploader.password },
    uploaderBCredentials: {
      email: uploaderB.email,
      password: uploaderB.password,
    },
    providerId: TEST_PROVIDER_ID,
  };
}
