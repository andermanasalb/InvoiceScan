import { ok, err, Result } from 'neverthrow';
import { TokenStorePort } from '../ports/token-store.port';
import { RefreshTokenInput, RefreshTokenOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidCredentialsError } from '../../domain/errors';

/** TTL for refresh tokens: 7 days in seconds (must match login.use-case.ts) */
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

export interface JwtVerifyPort {
  verifyRefreshToken(token: string): { sub: string } | null;
  signAccessToken(payload: { sub: string; role: string }): string;
  signRefreshToken(payload: { sub: string }): string;
}

export interface UserRoleLoader {
  getRoleByUserId(userId: string): Promise<string | null>;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly tokenStore: TokenStorePort,
    private readonly jwtVerifier: JwtVerifyPort,
    private readonly roleLoader: UserRoleLoader,
  ) {}

  async execute(
    input: RefreshTokenInput,
  ): Promise<Result<RefreshTokenOutput, DomainError>> {
    // 1. Verify the JWT signature and structure
    const payload = this.jwtVerifier.verifyRefreshToken(input.refreshToken);
    if (!payload || payload.sub !== input.userId) {
      return err(new InvalidCredentialsError());
    }

    // 2. Check token is still in Redis (not revoked).
    //    This also detects refresh token reuse: if the same token is presented
    //    twice (e.g. after a previous rotation), the stored value will differ
    //    and we reject immediately.
    const stored = await this.tokenStore.get(input.userId);
    if (stored !== input.refreshToken) {
      // Potential token theft / reuse detected: revoke everything for this user.
      await this.tokenStore.delete(input.userId);
      return err(new InvalidCredentialsError());
    }

    // 3. Load current role (may have changed since token was issued)
    const role = await this.roleLoader.getRoleByUserId(input.userId);
    if (!role) return err(new InvalidCredentialsError());

    // 4. Rotate the refresh token (issue a new one, invalidate the old one).
    //    This limits the window of opportunity if a refresh token is stolen:
    //    after the legitimate user refreshes, the stolen token is worthless.
    const newRefreshToken = this.jwtVerifier.signRefreshToken({
      sub: input.userId,
    });
    await this.tokenStore.set(input.userId, newRefreshToken, REFRESH_TOKEN_TTL);

    // 5. Issue new access token
    const accessToken = this.jwtVerifier.signAccessToken({
      sub: input.userId,
      role,
    });

    return ok({ accessToken, refreshToken: newRefreshToken });
  }
}
