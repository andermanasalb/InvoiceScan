/**
 * Re-exports from @invoice-flow/shared — single source of truth.
 * This file exists only for backwards compatibility with existing imports.
 * Prefer importing directly from '@invoice-flow/shared' in new code.
 */
export type { ApiError, ApiResponse, LoginResponse, RefreshResponse } from '@invoice-flow/shared';

import type { UserRole } from '@invoice-flow/shared';

/** Frontend-only: in-memory auth state managed by AuthContext. */
export interface AuthUser {
  accessToken: string;
  userId: string;
  role: UserRole;
}

/** Frontend-only: React reducer state for the auth context. */
export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

/** Frontend-only: form input for the login page. */
export interface LoginCredentials {
  email: string;
  password: string;
}
