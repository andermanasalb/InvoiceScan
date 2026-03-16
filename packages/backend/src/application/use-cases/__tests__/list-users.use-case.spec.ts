import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListUsersUseCase } from '../list-users.use-case';
import type { UserRepository } from '../../../domain/repositories';
import { createUser } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

describe('ListUsersUseCase', () => {
  let mockUserRepo: UserRepository;
  let useCase: ListUsersUseCase;

  const adminUser = createUser({ role: UserRole.ADMIN });
  const validatorUser = createUser({ role: UserRole.VALIDATOR });
  const uploaderUser = createUser({ role: UserRole.UPLOADER });

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn(),
      findAll: vi
        .fn()
        .mockResolvedValue([adminUser, validatorUser, uploaderUser]),
      findByEmail: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new ListUsersUseCase(mockUserRepo);
  });

  describe('execute', () => {
    it('should return ok with list of all users when no role filter is provided', async () => {
      const result = await useCase.execute({});

      expect(result.isOk()).toBe(true);
      const { users } = result._unsafeUnwrap();
      expect(users).toHaveLength(3);
    });

    it('should pass role filter to userRepo.findAll', async () => {
      await useCase.execute({ role: 'validator' });

      expect(mockUserRepo.findAll).toHaveBeenCalledWith('validator');
    });

    it('should map users to the expected output shape', async () => {
      const result = await useCase.execute({});

      const { users } = result._unsafeUnwrap();
      const first = users[0];
      expect(first).toHaveProperty('userId');
      expect(first).toHaveProperty('email');
      expect(first).toHaveProperty('role');
      expect(first).toHaveProperty('createdAt');
    });

    it('should return an empty list when no users match', async () => {
      mockUserRepo.findAll = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute({ role: 'approver' });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().users).toHaveLength(0);
    });
  });
});
