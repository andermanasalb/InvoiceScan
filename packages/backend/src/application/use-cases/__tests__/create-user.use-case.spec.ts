import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../create-user.use-case';
import { UserRepository } from '../../../domain/repositories';
import { createUser } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

describe('CreateUserUseCase', () => {
  let mockRepo: UserRepository;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };

    useCase = new CreateUserUseCase(mockRepo);
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

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should return err when email already exists', async () => {
      mockRepo.findByEmail = vi.fn().mockResolvedValue(createUser());

      const result = await useCase.execute({
        email: 'existing@example.com',
        role: UserRole.UPLOADER,
        password: 'securepassword123',
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('USER_ALREADY_EXISTS');
    });
  });
});
