import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUseCase, JwtSignPort } from '../login.use-case';
import { UserRepository } from '../../../domain/repositories';
import { UserCredentialRepository } from '../../../domain/repositories/user-credential.repository';
import { TokenStorePort } from '../../ports/token-store.port';
import { createUser } from '../../../domain/test/factories';

// Mock bcrypt — avoid real hashing in unit tests
vi.mock('bcrypt', () => ({
  compare: vi.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('LoginUseCase', () => {
  let userRepo: UserRepository;
  let credentialRepo: UserCredentialRepository;
  let tokenStore: TokenStorePort;
  let jwtSigner: JwtSignPort;
  let useCase: LoginUseCase;

  const fakeUser = createUser({ email: 'alice@example.com' });
  const fakeCredential = {
    id: 'cred-1',
    userId: fakeUser.getId(),
    passwordHash: '$2b$12$hashedpassword',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(fakeUser),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    credentialRepo = {
      findByUserId: vi.fn().mockResolvedValue(fakeCredential),
      save: vi.fn(),
    };

    tokenStore = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn(),
    };

    jwtSigner = {
      signAccessToken: vi.fn().mockReturnValue('access.token.mock'),
      signRefreshToken: vi.fn().mockReturnValue('refresh.token.mock'),
    };

    useCase = new LoginUseCase(userRepo, credentialRepo, tokenStore, jwtSigner);
  });

  describe('execute', () => {
    it('should return tokens when credentials are valid', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await useCase.execute({
        email: 'alice@example.com',
        password: 'correct-password',
      });

      expect(result.isOk()).toBe(true);
      const output = result._unsafeUnwrap();
      expect(output.accessToken).toBe('access.token.mock');
      expect(output.refreshToken).toBe('refresh.token.mock');
      expect(output.userId).toBe(fakeUser.getId());
    });

    it('should persist the refresh token in the token store', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await useCase.execute({
        email: 'alice@example.com',
        password: 'correct-password',
      });

      expect(tokenStore.set).toHaveBeenCalledOnce();
      expect(tokenStore.set).toHaveBeenCalledWith(
        fakeUser.getId(),
        'refresh.token.mock',
        expect.any(Number),
      );
    });

    it('should return InvalidCredentials when user is not found', async () => {
      userRepo.findByEmail = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        email: 'unknown@example.com',
        password: 'any',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return InvalidCredentials when password is wrong', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await useCase.execute({
        email: 'alice@example.com',
        password: 'wrong-password',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });

    it('should return InvalidCredentials when credential record is missing', async () => {
      credentialRepo.findByUserId = vi.fn().mockResolvedValue(null);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await useCase.execute({
        email: 'alice@example.com',
        password: 'any',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
    });
  });
});
