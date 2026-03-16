import { z } from 'zod';

// ── Login ─────────────────────────────────────────────────────────────────────
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: string;
  email: string;
}

// ── Refresh token ─────────────────────────────────────────────────────────────
export const RefreshTokenInputSchema = z.object({
  userId: z.string().uuid(),
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export interface RefreshTokenOutput {
  accessToken: string;
  /** Rotated refresh token — must be stored in the HttpOnly cookie. */
  refreshToken: string;
}

// ── Logout ────────────────────────────────────────────────────────────────────
export const LogoutInputSchema = z.object({
  userId: z.string().uuid(),
});
export type LogoutInput = z.infer<typeof LogoutInputSchema>;
