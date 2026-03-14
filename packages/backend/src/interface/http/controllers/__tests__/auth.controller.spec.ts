import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  AuthController,
  LOGIN_USE_CASE_TOKEN,
  REFRESH_TOKEN_USE_CASE_TOKEN,
  LOGOUT_USE_CASE_TOKEN,
} from '../auth.controller';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../guards/jwt.strategy';

// ---------------------------------------------------------------------------
// Shared fake user attached to req.user by the mock JWT guard
// ---------------------------------------------------------------------------
const FAKE_USER: AuthenticatedUser = {
  userId: 'user-uuid-001',
  role: 'uploader',
};

// ---------------------------------------------------------------------------
// Test module setup
// ---------------------------------------------------------------------------

/**
 * Auth controller tests run the full NestJS HTTP pipeline in memory.
 *
 * Both JwtAuthGuard and ThrottlerGuard are replaced with pass-through
 * implementations so tests are not blocked by missing Passport setup or
 * rate-limit counters.
 */
describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const mockLoginUseCase = { execute: vi.fn() };
  const mockRefreshUseCase = { execute: vi.fn() };
  const mockLogoutUseCase = { execute: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LOGIN_USE_CASE_TOKEN, useValue: mockLoginUseCase },
        { provide: REFRESH_TOKEN_USE_CASE_TOKEN, useValue: mockRefreshUseCase },
        { provide: LOGOUT_USE_CASE_TOKEN, useValue: mockLogoutUseCase },
        // Register the mock JWT guard globally (same way app.module.ts does),
        // so it runs for ALL routes including refresh and logout.
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              const req = ctx
                .switchToHttp()
                .getRequest<{ user: AuthenticatedUser }>();
              req.user = FAKE_USER;
              return true;
            },
          },
        },
      ],
    })
      // Bypass throttler — not what we're testing here
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    // cookie-parser needed for refresh endpoint to read req.cookies
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 with accessToken and set refreshToken cookie on valid credentials', async () => {
      mockLoginUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: {
          accessToken: 'access.token.here',
          refreshToken: 'refresh.token.here',
          userId: FAKE_USER.userId,
          role: FAKE_USER.role,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'secret123' });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe('access.token.here');
      expect(response.body.data.userId).toBe(FAKE_USER.userId);
      expect(response.body.data.role).toBe(FAKE_USER.role);
      // HttpOnly cookie must be set
      const setCookie = response.headers['set-cookie'] as string[] | string;
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(
        true,
      );
    });

    it('should return 401 when credentials are invalid', async () => {
      mockLoginUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: 'secret123' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when email is malformed', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'secret123' });

      expect(response.status).toBe(400);
    });

    it('should forward email and password to the use case', async () => {
      mockLoginUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: {
          accessToken: 'tok',
          refreshToken: 'rtok',
          userId: FAKE_USER.userId,
          role: FAKE_USER.role,
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'p@ss' });

      const arg = mockLoginUseCase.execute.mock.calls.at(-1)?.[0] as {
        email: string;
        password: string;
      };
      expect(arg.email).toBe('user@example.com');
      expect(arg.password).toBe('p@ss');
    });
  });

  // ── POST /api/v1/auth/refresh ─────────────────────────────────────────────

  // A fake refresh token whose base64url-encoded payload contains
  // { sub: FAKE_USER.userId } — the controller decodes this to extract userId.
  const FAKE_REFRESH_TOKEN = 'header.eyJzdWIiOiJ1c2VyLXV1aWQtMDAxIn0.sig';

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 200 with new accessToken when refresh cookie is valid', async () => {
      mockRefreshUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { accessToken: 'new.access.token' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${FAKE_REFRESH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe('new.access.token');
    });

    it('should return 401 when no refresh cookie is present', async () => {
      const response = await request(app.getHttpServer()).post(
        '/api/v1/auth/refresh',
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when refresh token is invalid or expired', async () => {
      mockRefreshUseCase.execute.mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: { code: 'INVALID_CREDENTIALS', message: 'Token expired' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${FAKE_REFRESH_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should forward the userId from the JWT to the use case', async () => {
      mockRefreshUseCase.execute.mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: { accessToken: 'tok' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${FAKE_REFRESH_TOKEN}`);

      const arg = mockRefreshUseCase.execute.mock.calls.at(-1)?.[0] as {
        userId: string;
        refreshToken: string;
      };
      expect(arg.userId).toBe(FAKE_USER.userId);
      expect(arg.refreshToken).toBe(FAKE_REFRESH_TOKEN);
    });
  });

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should return 204 and clear the refreshToken cookie', async () => {
      mockLogoutUseCase.execute.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=some.token');

      expect(response.status).toBe(204);
      // Cookie must be cleared (value becomes empty or expires in the past)
      const setCookie = response.headers['set-cookie'] as
        | string[]
        | string
        | undefined;
      const cookies = Array.isArray(setCookie)
        ? setCookie
        : setCookie
          ? [setCookie]
          : [];
      const cleared = cookies.find((c) => c.startsWith('refreshToken='));
      expect(cleared).toBeDefined();
      // A cleared cookie has an empty value or an expired Max-Age
      expect(cleared).toMatch(/refreshToken=;|Max-Age=0/);
    });

    it('should delegate to the logout use case with the userId from JWT', async () => {
      mockLogoutUseCase.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refreshToken=some.token');

      const arg = mockLogoutUseCase.execute.mock.calls.at(-1)?.[0] as {
        userId: string;
      };
      expect(arg.userId).toBe(FAKE_USER.userId);
    });
  });
});
