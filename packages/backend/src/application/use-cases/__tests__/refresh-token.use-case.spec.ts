import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RefreshTokenUseCase,
  JwtVerifyPort,
  UserRoleLoader,
} from '../refresh-token.use-case';
import { TokenStorePort } from '../../ports/token-store.port';

describe('RefreshTokenUseCase', () => {
  let tokenStore: TokenStorePort;
  let jwtVerifier: JwtVerifyPort;
  let roleLoader: UserRoleLoader;
  let useCase: RefreshTokenUseCase;

  const userId = 'user-uuid-123';
  const storedToken = 'valid.refresh.token';

  beforeEach(() => {
    tokenStore = {
      set: vi.fn(),
      get: vi.fn().mockResolvedValue(storedToken),
      delete: vi.fn(),
    };

    jwtVerifier = {
      verifyRefreshToken: vi.fn().mockReturnValue({ sub: userId }),
      signAccessToken: vi.fn().mockReturnValue('new.access.token'),
    };

    roleLoader = {
      getRoleByUserId: vi.fn().mockResolvedValue('uploader'),
    };

    useCase = new RefreshTokenUseCase(tokenStore, jwtVerifier, roleLoader);
  });

  describe('execute', () => {
    it('should return a new access token when refresh token is valid', async () => {
      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().accessToken).toBe('new.access.token');
    });

    it('should return InvalidCredentials when JWT signature is invalid', async () => {
      jwtVerifier.verifyRefreshToken = vi.fn().mockReturnValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: 'tampered.token',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return InvalidCredentials when token is not in Redis (revoked)', async () => {
      tokenStore.get = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return InvalidCredentials when stored token does not match', async () => {
      tokenStore.get = vi.fn().mockResolvedValue('different.token');

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return InvalidCredentials when user no longer exists', async () => {
      roleLoader.getRoleByUserId = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });
  });
});
