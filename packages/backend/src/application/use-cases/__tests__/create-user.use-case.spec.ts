import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../create-user.use-case';
import { UserRepository } from '../../../domain/repositories';
import { UserCredentialRepository } from '../../../domain/repositories/user-credential.repository';
import { createUser } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

// Mock bcrypt so tests don't actually hash passwords (slow + non-deterministic)
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password_mock'),
}));

describe('CreateUserUseCase', () => {
  let mockUserRepo: UserRepository;
  let mockCredentialRepo: UserCredentialRepository;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };

    mockCredentialRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateUserUseCase(mockUserRepo, mockCredentialRepo);
  });

  describe('execute', () => {
    it('should return ok with user data when email is unique', async () => {
      const result = await useCase.execute({
        email: 'new@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().email).toBe('new@example.com');
      expect(result._unsafeUnwrap().role).toBe(UserRole.UPLOADER);
    });

    it('should persist the user', async () => {
      await useCase.execute({
        email: 'new@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(mockUserRepo.save).toHaveBeenCalledOnce();
    });

    it('should persist the hashed credential', async () => {
      await useCase.execute({
        email: 'new@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(mockCredentialRepo.save).toHaveBeenCalledOnce();
      expect(mockCredentialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed_password_mock' }),
      );
    });

    it('should return err when email already exists', async () => {
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(createUser());

      const result = await useCase.execute({
        email: 'existing@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('USER_ALREADY_EXISTS');
    });

    it('should not persist credential when email already exists', async () => {
      mockUserRepo.findByEmail = vi.fn().mockResolvedValue(createUser());

      await useCase.execute({
        email: 'existing@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(mockCredentialRepo.save).not.toHaveBeenCalled();
    });
  });
});
