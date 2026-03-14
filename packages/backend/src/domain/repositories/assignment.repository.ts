import type {
  UploaderValidatorAssignment,
  ValidatorApproverAssignment,
  AssignmentTree,
} from '../entities/assignment.entity';

export const ASSIGNMENT_REPOSITORY = 'AssignmentRepository';

export interface AssignmentRepository {
  /** Assign an uploader to a validator (upserts — replaces previous assignment). */
  assignUploaderToValidator(
    uploaderId: string,
    validatorId: string,
    createdBy: string,
  ): Promise<UploaderValidatorAssignment>;

  /** Assign a validator to an approver (upserts — replaces previous assignment). */
  assignValidatorToApprover(
    validatorId: string,
    approverId: string,
    createdBy: string,
  ): Promise<ValidatorApproverAssignment>;

  /** Remove an uploader's assignment (the uploader becomes unassigned). */
  removeUploaderAssignment(uploaderId: string): Promise<void>;

  /** Remove a validator's approver assignment. */
  removeValidatorAssignment(validatorId: string): Promise<void>;

  /** IDs of uploaders assigned to this validator. */
  getAssignedUploaderIds(validatorId: string): Promise<string[]>;

  /** IDs of validators assigned to this approver. */
  getAssignedValidatorIds(approverId: string): Promise<string[]>;

  /** Validator assigned to this uploader, or null if unassigned. */
  getAssignedValidatorForUploader(uploaderId: string): Promise<string | null>;

  /** Approver assigned to this validator, or null if unassigned. */
  getAssignedApproverForValidator(validatorId: string): Promise<string | null>;

  /** Full hierarchy tree for the admin UI. */
  getFullTree(): Promise<AssignmentTree>;
}
