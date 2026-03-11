import { ok, err, Result } from 'neverthrow';
import { TokenStorePort } from '../ports/token-store.port';
import { RefreshTokenInput, RefreshTokenOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidCredentialsError } from '../../domain/errors';

export interface JwtVerifyPort {
  verifyRefreshToken(token: string): { sub: string } | null;
  signAccessToken(payload: { sub: string; role: string }): string;
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

    // 2. Check token is still in Redis (not revoked)
    const stored = await this.tokenStore.get(input.userId);
    if (stored !== input.refreshToken) {
      return err(new InvalidCredentialsError());
    }

    // 3. Load current role (may have changed since token was issued)
    const role = await this.roleLoader.getRoleByUserId(input.userId);
    if (!role) return err(new InvalidCredentialsError());

    // 4. Issue new access token
    const accessToken = this.jwtVerifier.signAccessToken({
      sub: input.userId,
      role,
    });

    return ok({ accessToken });
  }
}
