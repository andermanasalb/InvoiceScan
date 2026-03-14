import { ok, err, Result } from 'neverthrow';
import bcrypt from 'bcrypt';
import { UserRepository } from '../../domain/repositories';
import { UserCredentialRepository } from '../../domain/repositories/user-credential.repository';
import { TokenStorePort } from '../ports/token-store.port';
import { LoginInput, LoginOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidCredentialsError } from '../../domain/errors';

/** TTL for refresh tokens: 7 days in seconds */
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

export interface JwtSignPort {
  signAccessToken(payload: { sub: string; role: string }): string;
  signRefreshToken(payload: { sub: string }): string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly credentialRepo: UserCredentialRepository,
    private readonly tokenStore: TokenStorePort,
    private readonly jwtSigner: JwtSignPort,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutput, DomainError>> {
    // 1. Find user by email
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) return err(new InvalidCredentialsError());

    // 2. Load hashed credential
    const credential = await this.credentialRepo.findByUserId(user.getId());
    if (!credential) return err(new InvalidCredentialsError());

    // 3. Verify password

    const valid = await bcrypt.compare(input.password, credential.passwordHash);
    if (!valid) return err(new InvalidCredentialsError());

    // 4. Sign tokens
    const accessToken = this.jwtSigner.signAccessToken({
      sub: user.getId(),
      role: user.getRole(),
    });
    const refreshToken = this.jwtSigner.signRefreshToken({ sub: user.getId() });

    // 5. Persist refresh token in Redis
    await this.tokenStore.set(user.getId(), refreshToken, REFRESH_TOKEN_TTL);

    return ok({
      accessToken,
      refreshToken,
      userId: user.getId(),
      role: user.getRole(),
      email: user.getEmail(),
    });
  }
}
