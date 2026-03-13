import type { UserRole } from './invoice';

export interface AuthUser {
  accessToken: string;
  userId: string;
  role: UserRole;
}

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    accessToken: string;
    userId: string;
    role: UserRole;
  };
}

export interface RefreshResponse {
  data: {
    accessToken: string;
  };
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
