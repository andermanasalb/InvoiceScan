/**
 * auth-e2e.helper.ts
 *
 * Thin wrapper around POST /api/v1/auth/login.
 * Returns the accessToken and the raw Set-Cookie header so specs can
 * pass the refresh token cookie in subsequent requests.
 *
 * Usage:
 *   const { accessToken, cookie } = await loginAs(http, 'user@test.com', 'pass');
 *   await request(http)
 *     .patch('/api/v1/invoices/123/approve')
 *     .set('Authorization', `Bearer ${accessToken}`)
 *     .expect(200);
 */

import request from 'supertest';

export interface LoginResult {
  accessToken: string;
  /** Raw Set-Cookie header value — pass to .set('Cookie', cookie) */
  cookie: string;
  userId: string;
  role: string;
}

export async function loginAs(
  http: ReturnType<import('@nestjs/common').INestApplication['getHttpServer']>,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await request(http)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? '');

  return {
    accessToken: (res.body as { data: { accessToken: string } }).data
      .accessToken,
    cookie,
    userId: (res.body as { data: { userId: string } }).data.userId,
    role: (res.body as { data: { role: string } }).data.role,
  };
}
