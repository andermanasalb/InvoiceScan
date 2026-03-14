import { ok, err, Result } from 'neverthrow';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import type { UserRepository } from '../../domain/repositories';
import type { AssignValidatorInput } from '../dtos/assignment.dto';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidRoleError, UserNotFoundError } from '../../domain/errors';
import type { ValidatorApproverAssignment } from '../../domain/entities/assignment.entity';

export class AssignValidatorUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(
    input: AssignValidatorInput,
  ): Promise<Result<ValidatorApproverAssignment, DomainError>> {
    const [validator, approver] = await Promise.all([
      this.userRepo.findById(input.validatorId),
      this.userRepo.findById(input.approverId),
    ]);

    if (!validator) return err(new UserNotFoundError(input.validatorId));
    if (!approver) return err(new UserNotFoundError(input.approverId));

    if (validator.getRole() !== 'validator') {
      return err(
        new InvalidRoleError(
          `User ${input.validatorId} is not a validator (role: ${validator.getRole()})`,
        ),
      );
    }
    if (approver.getRole() !== 'approver') {
      return err(
        new InvalidRoleError(
          `User ${input.approverId} is not an approver (role: ${approver.getRole()})`,
        ),
      );
    }

    const assignment = await this.assignmentRepo.assignValidatorToApprover(
      input.validatorId,
      input.approverId,
      input.adminId,
    );

    return ok(assignment);
  }
}
