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
  const rotatedToken = 'rotated.refresh.token';

  beforeEach(() => {
    tokenStore = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(storedToken),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    jwtVerifier = {
      verifyRefreshToken: vi.fn().mockReturnValue({ sub: userId }),
      signAccessToken: vi.fn().mockReturnValue('new.access.token'),
      signRefreshToken: vi.fn().mockReturnValue(rotatedToken),
    };

    roleLoader = {
      getRoleByUserId: vi.fn().mockResolvedValue('uploader'),
    };

    useCase = new RefreshTokenUseCase(tokenStore, jwtVerifier, roleLoader);
  });

  describe('execute — happy path', () => {
    it('should return a new access token when refresh token is valid', async () => {
      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().accessToken).toBe('new.access.token');
    });

    it('should return a rotated refresh token on success', async () => {
      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().refreshToken).toBe(rotatedToken);
    });

    it('should persist the rotated refresh token in Redis', async () => {
      await useCase.execute({ userId, refreshToken: storedToken });

      expect(tokenStore.set).toHaveBeenCalledWith(
        userId,
        rotatedToken,
        expect.any(Number),
      );
    });
  });

  describe('execute — error paths', () => {
    it('should return INVALID_CREDENTIALS when JWT signature is invalid', async () => {
      jwtVerifier.verifyRefreshToken = vi.fn().mockReturnValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: 'tampered.token',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return INVALID_CREDENTIALS when token is not in Redis (revoked)', async () => {
      tokenStore.get = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return INVALID_CREDENTIALS when stored token does not match (reuse attack)', async () => {
      tokenStore.get = vi.fn().mockResolvedValue('different.token');

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should revoke all tokens (delete from Redis) on reuse-attack detection', async () => {
      tokenStore.get = vi.fn().mockResolvedValue('different.token');

      await useCase.execute({ userId, refreshToken: storedToken });

      expect(tokenStore.delete).toHaveBeenCalledWith(userId);
    });

    it('should return INVALID_CREDENTIALS when user no longer exists', async () => {
      roleLoader.getRoleByUserId = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        userId,
        refreshToken: storedToken,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should not rotate the token when JWT verification fails', async () => {
      jwtVerifier.verifyRefreshToken = vi.fn().mockReturnValue(null);

      await useCase.execute({ userId, refreshToken: storedToken });

      expect(tokenStore.set).not.toHaveBeenCalled();
    });
  });
});
