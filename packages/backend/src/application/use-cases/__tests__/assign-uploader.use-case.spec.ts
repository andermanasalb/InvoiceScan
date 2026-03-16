import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignUploaderUseCase } from '../assign-uploader.use-case';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';
import type { UserRepository } from '../../../domain/repositories';
import { createUser } from '../../../domain/test/factories';
import { UserRole } from '../../../domain/entities/user.entity';

const ADMIN_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UPLOADER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const VALIDATOR_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const mockAssignment = {
  id: 'assign-1',
  uploaderId: UPLOADER_ID,
  validatorId: VALIDATOR_ID,
  adminId: ADMIN_ID,
  createdAt: new Date(),
};

describe('AssignUploaderUseCase', () => {
  let mockAssignmentRepo: AssignmentRepository;
  let mockUserRepo: UserRepository;
  let useCase: AssignUploaderUseCase;

  const uploaderUser = createUser({ id: UPLOADER_ID, role: UserRole.UPLOADER });
  const validatorUser = createUser({
    id: VALIDATOR_ID,
    role: UserRole.VALIDATOR,
  });

  beforeEach(() => {
    mockAssignmentRepo = {
      assignUploaderToValidator: vi.fn().mockResolvedValue(mockAssignment),
      assignValidatorToApprover: vi.fn(),
      getAssignedUploaderIds: vi.fn(),
      getAssignedValidatorIds: vi.fn(),
      getAssignedValidatorForUploader: vi.fn(),
      getAssignedApproverForValidator: vi.fn(),
      removeUploaderAssignment: vi.fn(),
      removeValidatorAssignment: vi.fn(),
      getFullTree: vi.fn(),
    };

    mockUserRepo = {
      findById: vi.fn().mockImplementation((id: string) => {
        if (id === UPLOADER_ID) return Promise.resolve(uploaderUser);
        if (id === VALIDATOR_ID) return Promise.resolve(validatorUser);
        return Promise.resolve(null);
      }),
      findAll: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new AssignUploaderUseCase(mockAssignmentRepo, mockUserRepo);
  });

  describe('execute', () => {
    it('should return ok with the created assignment', async () => {
      const result = await useCase.execute({
        uploaderId: UPLOADER_ID,
        validatorId: VALIDATOR_ID,
        adminId: ADMIN_ID,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().uploaderId).toBe(UPLOADER_ID);
      expect(result._unsafeUnwrap().validatorId).toBe(VALIDATOR_ID);
    });

    it('should return err USER_NOT_FOUND when uploader does not exist', async () => {
      mockUserRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({
        uploaderId: UPLOADER_ID,
        validatorId: VALIDATOR_ID,
        adminId: ADMIN_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('USER_NOT_FOUND');
    });

    it('should return err USER_NOT_FOUND when validator does not exist', async () => {
      mockUserRepo.findById = vi.fn().mockImplementation((id: string) => {
        if (id === UPLOADER_ID) return Promise.resolve(uploaderUser);
        return Promise.resolve(null);
      });

      const result = await useCase.execute({
        uploaderId: UPLOADER_ID,
        validatorId: VALIDATOR_ID,
        adminId: ADMIN_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('USER_NOT_FOUND');
    });

    it('should return err INVALID_ROLE when uploaderId belongs to a non-uploader', async () => {
      const approverUser = createUser({
        id: UPLOADER_ID,
        role: UserRole.APPROVER,
      });
      mockUserRepo.findById = vi.fn().mockImplementation((id: string) => {
        if (id === UPLOADER_ID) return Promise.resolve(approverUser);
        if (id === VALIDATOR_ID) return Promise.resolve(validatorUser);
        return Promise.resolve(null);
      });

      const result = await useCase.execute({
        uploaderId: UPLOADER_ID,
        validatorId: VALIDATOR_ID,
        adminId: ADMIN_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_ROLE');
    });

    it('should return err INVALID_ROLE when validatorId belongs to a non-validator', async () => {
      const uploaderAsValidator = createUser({
        id: VALIDATOR_ID,
        role: UserRole.UPLOADER,
      });
      mockUserRepo.findById = vi.fn().mockImplementation((id: string) => {
        if (id === UPLOADER_ID) return Promise.resolve(uploaderUser);
        if (id === VALIDATOR_ID) return Promise.resolve(uploaderAsValidator);
        return Promise.resolve(null);
      });

      const result = await useCase.execute({
        uploaderId: UPLOADER_ID,
        validatorId: VALIDATOR_ID,
        adminId: ADMIN_ID,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_ROLE');
    });
  });
});
