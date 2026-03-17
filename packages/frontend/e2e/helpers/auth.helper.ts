/**
 * auth.helper.ts
 *
 * Programmatic login via the backend API (not through the UI).
 * Used in fixtures and globalSetup to obtain access tokens and
 * inject session state into Playwright browser contexts — skipping
 * the login page for tests that don't need to test auth itself.
 *
 * The access token is injected into sessionStorage (userId, role, email)
 * and into the in-memory axios token via localStorage key "__pw_access_token"
 * which is read by a custom Next.js initialiser only in test mode.
 *
 * Because the frontend stores the access token in-memory (not in any
 * storage), we use Playwright's storageState to persist sessionStorage
 * metadata and then set the token via a page.evaluate() call after navigation.
 */

import type { BrowserContext, Page } from '@playwright/test';
import axios from 'axios';

// BACKEND_URL should NOT include /api/v1 — this helper appends it.
const BACKEND_BASE = process.env.BACKEND_URL ?? 'http://localhost:3000';
const BACKEND_URL = `${BACKEND_BASE}/api/v1`;

export interface LoginResult {
  accessToken: string;
  userId: string;
  role: string;
  email: string;
  /** Raw cookie string from Set-Cookie header (refresh token) */
  cookie: string;
}

/**
 * Login via the backend REST API directly (no browser involved).
 * Returns the access token + refresh cookie.
 */
export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResult> {
  const response = await axios.post(
    `${BACKEND_URL}/auth/login`,
    { email, password },
    { withCredentials: false },
  );

  const body = response.data as {
    data: { accessToken: string; userId: string; role: string; email: string };
  };

  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie)
    ? (setCookie[0] ?? '')
    : (setCookie ?? '');

  return {
    accessToken: body.data.accessToken,
    userId: body.data.userId,
    role: body.data.role,
    email: body.data.email,
    cookie,
  };
}

/**
 * Inject auth state into a Playwright page so the frontend treats
 * the browser as already authenticated.
 *
 * Strategy:
 *   1. Navigate to /login (loads the app shell).
 *   2. Write sessionStorage keys (userId, role, email).
 *   3. Store the access token in window.__pw_access_token so the
 *      frontend can pick it up on next render.  We also patch the
 *      axios in-memory token via a page.evaluate.
 *   4. Navigate to the target URL.
 */
export async function injectAuth(
  page: Page,
  loginResult: LoginResult,
  targetPath = '/dashboard',
): Promise<void> {
  // First visit — page needs to load at least once so JS is running
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await page.evaluate(
    ({ userId, role, email, accessToken }) => {
      sessionStorage.setItem('auth:userId', userId);
      sessionStorage.setItem('auth:role', role);
      sessionStorage.setItem('auth:email', email);
      // Store token so the axios interceptor picks it up on the
      // first authenticated request (silent-refresh path).
      // We expose it via a well-known window property; the interceptor
      // in api.ts will read it before the first 401 is thrown.
      (window as Record<string, unknown>)['__pw_access_token'] = accessToken;
    },
    {
      userId: loginResult.userId,
      role: loginResult.role,
      email: loginResult.email,
      accessToken: loginResult.accessToken,
    },
  );

  // Navigate to the actual target page
  await page.goto(targetPath, { waitUntil: 'load' });
}

/**
 * Set the refresh-token cookie on a browser context so the backend
 * can issue a new access token when the current one expires.
 */
export async function setRefreshCookie(
  context: BrowserContext,
  cookie: string,
  frontendOrigin = 'http://localhost:3001',
): Promise<void> {
  // Parse the cookie string: "refreshToken=xxx; Path=/; HttpOnly; ..."
  const parts = cookie.split(';').map((p) => p.trim());
  const [nameValue] = parts;
  if (!nameValue) return;

  const eqIdx = nameValue.indexOf('=');
  if (eqIdx === -1) return;

  const name = nameValue.slice(0, eqIdx);
  const value = nameValue.slice(eqIdx + 1);

  await context.addCookies([
    {
      name,
      value,
      url: frontendOrigin,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
