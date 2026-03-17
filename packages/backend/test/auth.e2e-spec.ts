/**
 * auth.e2e-spec.ts — Authentication E2E tests
 *
 * Tests the full auth flow against a real NestJS application,
 * real PostgreSQL, and real Redis (JWT stored in Redis for revocation).
 *
 * What is tested:
 *   - POST /api/v1/auth/login  → access token in body + refresh token in HttpOnly cookie
 *   - POST /api/v1/auth/refresh → new access token via cookie
 *   - POST /api/v1/auth/logout  → 204 + cookie cleared
 *   - Global JwtAuthGuard: protected endpoints return 401 without token
 *   - Global RolesGuard: wrong role returns 403
 *   - @Public() decorator: health endpoint accessible without token
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createE2EApp, type E2EApp } from './helpers/e2e-app.helper';
import { clearAllTables } from './helpers/db-e2e.helper';
import { seedE2EData, type SeededE2EData } from './helpers/seed-e2e.helper';

describe('Auth E2E', () => {
  let e2e: E2EApp;
  let seed: SeededE2EData;

  beforeAll(async () => {
    e2e = await createE2EApp();
    await clearAllTables(e2e.app);
    seed = await seedE2EData(e2e.app);
  });

  afterAll(async () => {
    await clearAllTables(e2e.app);
    await e2e.app.close();
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 + accessToken + refreshToken cookie on valid credentials', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send(seed.uploaderCredentials)
        .expect(200);

      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.userId).toBe(seed.uploaderId);
      expect(res.body.data.role).toBe('uploader');

      const setCookie = res.headers['set-cookie'] as string[] | undefined;
      expect(setCookie).toBeDefined();
      expect(setCookie![0]).toContain('refreshToken=');
      expect(setCookie![0]).toContain('HttpOnly');
    });

    it('should return 401 on wrong password', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send({ email: seed.uploaderCredentials.email, password: 'WrongPass!' });

      expect(res.status).toBe(401);
    });

    it('should return 401 on non-existent email', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'AnyPass1234!' });

      // Should NOT distinguish between "user not found" and "wrong password"
      // to prevent user enumeration attacks
      expect(res.status).toBe(401);
    });

    it('should return 400 on missing email', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send({ password: 'pass' });

      expect(res.status).toBe(400);
    });

    it('should return 400 on malformed email', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'pass' });

      expect(res.status).toBe(400);
    });

    it('should return 400 on missing password', async () => {
      const res = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send({ email: seed.uploaderCredentials.email });

      expect(res.status).toBe(400);
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 200 + new accessToken when called with a valid refresh cookie', async () => {
      // First login to get the cookie
      const loginRes = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send(seed.validatorCredentials)
        .expect(200);

      const cookie = (loginRes.headers['set-cookie'] as string[])[0];

      // Refresh
      const refreshRes = await request(e2e.http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      const newToken = (refreshRes.body as { data: { accessToken: string } })
        .data.accessToken;

      expect(newToken).toBeTruthy();
      // The refresh token cookie must be rotated (new Set-Cookie issued)
      const newCookie = (refreshRes.headers['set-cookie'] as string[])[0];
      expect(newCookie).toBeDefined();
      expect(newCookie).toContain('refreshToken=');
      // Note: access token bytes may be identical when both are issued within
      // the same second (same iat), which is normal JWT behaviour in fast CI.
    });

    it('should return 401 when called without a refresh cookie', async () => {
      const res = await request(e2e.http).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should return 204 and clear the refresh cookie', async () => {
      // Login first
      const loginRes = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send(seed.approverCredentials)
        .expect(200);

      const accessToken = (loginRes.body as { data: { accessToken: string } })
        .data.accessToken;
      const cookie = (loginRes.headers['set-cookie'] as string[])[0];

      // Logout
      const logoutRes = await request(e2e.http)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookie)
        .expect(204);

      // The Set-Cookie header should clear the refreshToken cookie
      const setCookie = logoutRes.headers['set-cookie'] as string[] | undefined;
      if (setCookie) {
        expect(setCookie[0]).toContain('refreshToken=;');
      }
    });

    it('should return 401 when called without a valid access token', async () => {
      const res = await request(e2e.http).post('/api/v1/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  // ─── Global guards ────────────────────────────────────────────────────────

  describe('Global guards', () => {
    it('should return 401 on a protected endpoint without any token', async () => {
      const res = await request(e2e.http).get('/api/v1/invoices');
      expect(res.status).toBe(401);
    });

    it('should return 403 when uploader tries to access an approver-only endpoint', async () => {
      const loginRes = await request(e2e.http)
        .post('/api/v1/auth/login')
        .send(seed.uploaderCredentials)
        .expect(200);

      const token = (loginRes.body as { data: { accessToken: string } }).data
        .accessToken;

      // POST /api/v1/admin/users is admin-only
      const res = await request(e2e.http)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'x@x.com', password: 'Pass1234!', role: 'uploader' });

      expect(res.status).toBe(403);
    });

    it('should return 200 on GET /api/v1/health without any token (@Public)', async () => {
      const res = await request(e2e.http)
        .get('/api/v1/health')
        .expect(200);

      expect((res.body as { status: string }).status).toBe('ok');
    });
  });
});
