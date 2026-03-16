import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvoiceStatsUseCase } from '../get-invoice-stats.use-case';
import type { InvoiceRepository } from '../../../domain/repositories';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';
import { UserRole } from '../../../domain/entities/user.entity';

const REQUESTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALIDATOR_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const UPLOADER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

const mockCounts = {
  PENDING: 2,
  PROCESSING: 0,
  EXTRACTED: 1,
  VALIDATION_FAILED: 0,
  READY_FOR_VALIDATION: 3,
  READY_FOR_APPROVAL: 1,
  APPROVED: 5,
  REJECTED: 0,
};

describe('GetInvoiceStatsUseCase', () => {
  let mockInvoiceRepo: InvoiceRepository;
  let mockAssignmentRepo: AssignmentRepository;
  let useCase: GetInvoiceStatsUseCase;

  beforeEach(() => {
    mockInvoiceRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      findByUploaderIds: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      countByStatus: vi.fn().mockResolvedValue(mockCounts),
      countByStatusForUploader: vi.fn().mockResolvedValue(mockCounts),
      countByStatusForUploaderIds: vi.fn().mockResolvedValue(mockCounts),
      findUploaderEmail: vi.fn(),
    };

    mockAssignmentRepo = {
      assignUploaderToValidator: vi.fn(),
      assignValidatorToApprover: vi.fn(),
      getAssignedUploaderIds: vi.fn().mockResolvedValue([UPLOADER_ID]),
      getAssignedValidatorIds: vi.fn().mockResolvedValue([VALIDATOR_ID]),
      getAssignedValidatorForUploader: vi.fn(),
      getAssignedApproverForValidator: vi.fn(),
      removeUploaderAssignment: vi.fn(),
      removeValidatorAssignment: vi.fn(),
      getFullTree: vi.fn(),
    };

    useCase = new GetInvoiceStatsUseCase(mockInvoiceRepo, mockAssignmentRepo);
  });

  describe('execute — uploader role', () => {
    it('should call countByStatusForUploader with requesterId', async () => {
      const result = await useCase.execute({
        requesterId: REQUESTER_ID,
        requesterRole: UserRole.UPLOADER,
      });

      expect(result.isOk()).toBe(true);
      expect(mockInvoiceRepo.countByStatusForUploader).toHaveBeenCalledWith(
        REQUESTER_ID,
      );
    });
  });

  describe('execute — validator role', () => {
    it('should aggregate IDs from assigned uploaders + own', async () => {
      const result = await useCase.execute({
        requesterId: REQUESTER_ID,
        requesterRole: UserRole.VALIDATOR,
      });

      expect(result.isOk()).toBe(true);
      expect(mockAssignmentRepo.getAssignedUploaderIds).toHaveBeenCalledWith(
        REQUESTER_ID,
      );
      expect(mockInvoiceRepo.countByStatusForUploaderIds).toHaveBeenCalledWith(
        expect.arrayContaining([REQUESTER_ID, UPLOADER_ID]),
      );
    });
  });

  describe('execute — approver role', () => {
    it('should aggregate IDs from assigned validators and their uploaders', async () => {
      const result = await useCase.execute({
        requesterId: REQUESTER_ID,
        requesterRole: UserRole.APPROVER,
      });

      expect(result.isOk()).toBe(true);
      expect(mockAssignmentRepo.getAssignedValidatorIds).toHaveBeenCalledWith(
        REQUESTER_ID,
      );
      expect(mockAssignmentRepo.getAssignedUploaderIds).toHaveBeenCalledWith(
        VALIDATOR_ID,
      );
      expect(mockInvoiceRepo.countByStatusForUploaderIds).toHaveBeenCalledWith(
        expect.arrayContaining([REQUESTER_ID, VALIDATOR_ID, UPLOADER_ID]),
      );
    });
  });

  describe('execute — admin role', () => {
    it('should call global countByStatus for admin', async () => {
      const result = await useCase.execute({
        requesterId: REQUESTER_ID,
        requesterRole: UserRole.ADMIN,
      });

      expect(result.isOk()).toBe(true);
      expect(mockInvoiceRepo.countByStatus).toHaveBeenCalled();
    });
  });
});
