'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setAccessToken } from '@/lib/api';
import type { AuthState, LoginCredentials } from '@/types/auth';
import type { UserRole } from '@invoice-flow/shared';

// sessionStorage keys — solo metadatos, NUNCA el accessToken
const SESSION_KEY_USER_ID = 'auth:userId';
const SESSION_KEY_ROLE    = 'auth:role';
const SESSION_KEY_EMAIL   = 'auth:email';

// ─── State shape ─────────────────────────────────────────────────────────────

type AuthStateWithInit = AuthState & { isInitialized: boolean; email: string | null };

const defaultState: AuthStateWithInit = {
  accessToken:     null,
  userId:          null,
  role:            null,
  email:           null,
  isAuthenticated: false,
  isInitialized:   false,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { accessToken: string | null; userId: string; role: UserRole; email: string } }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN'; payload: { accessToken: string } };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function authReducer(state: AuthStateWithInit, action: AuthAction): AuthStateWithInit {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        accessToken:     action.payload.accessToken,
        userId:          action.payload.userId,
        role:            action.payload.role,
        email:           action.payload.email,
        isAuthenticated: true,
        isInitialized:   true,
      };
    case 'LOGOUT':
      return { ...defaultState, isInitialized: true };
    case 'REFRESH_TOKEN':
      return { ...state, accessToken: action.payload.accessToken };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lee sessionStorage al arrancar. Si hay metadatos guardados restauramos
 * isAuthenticated: true — el accessToken es null y se renovará automáticamente
 * en la primera petición 401 via el silent refresh del interceptor de axios.
 * En SSR (sin window) devuelve isInitialized: false para que el cliente hidrate.
 */
function getInitialState(): AuthStateWithInit {
  if (typeof window === 'undefined') {
    return defaultState; // SSR — isInitialized: false
  }

  const userId = sessionStorage.getItem(SESSION_KEY_USER_ID);
  const role   = sessionStorage.getItem(SESSION_KEY_ROLE) as UserRole | null;
  const email  = sessionStorage.getItem(SESSION_KEY_EMAIL);

  if (userId && role) {
    return {
      accessToken:     null, // se renueva vía silent refresh en la primera petición
      userId,
      role,
      email,
      isAuthenticated: true,
      isInitialized:   true,
    };
  }

  return { ...defaultState, isInitialized: true };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthContextType extends AuthStateWithInit {
  login:    (credentials: LoginCredentials) => Promise<void>;
  logout:   () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, getInitialState);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials.email, credentials.password);
      // authApi.login ya devuelve response.data del backend (axios).
      // El backend responde { data: { accessToken, userId, role } },
      // así que destructuramos desde .data directamente.
      const { accessToken, userId, role, email } = response.data;

      // 1. Token en memoria del módulo axios (nunca en storage)
      setAccessToken(accessToken);

      // 2. Metadatos en sessionStorage (se borran al cerrar la pestaña)
      sessionStorage.setItem(SESSION_KEY_USER_ID, userId);
      sessionStorage.setItem(SESSION_KEY_ROLE, role);
      sessionStorage.setItem(SESSION_KEY_EMAIL, email);

      // 3. Estado React
      dispatch({ type: 'LOGIN_SUCCESS', payload: { accessToken, userId, role, email } });

      router.push('/dashboard');
    } catch (err) {
      // Re-throw so the login page can catch and show the error
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Ignorar errores de logout — siempre limpiar sesión local
    } finally {
      // Limpiar sessionStorage
      sessionStorage.removeItem(SESSION_KEY_USER_ID);
      sessionStorage.removeItem(SESSION_KEY_ROLE);
      sessionStorage.removeItem(SESSION_KEY_EMAIL);

      dispatch({ type: 'LOGOUT' });
      setAccessToken(null);
      setIsLoading(false);

      // Use full navigation instead of router.push: this resets the in-memory
      // accessToken module state (api.ts) and avoids Next.js App Router issues
      // with router.push from async callbacks.
      window.location.href = '/login';
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ─── HOC para rutas protegidas ────────────────────────────────────────────────

export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isInitialized } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
      if (isInitialized && !isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, isInitialized, router]);

    if (!isInitialized || !isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
