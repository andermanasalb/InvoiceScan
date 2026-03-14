import { ok, err, Result } from 'neverthrow';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import type { UserRepository } from '../../domain/repositories';
import type { AssignUploaderInput } from '../dtos/assignment.dto';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidRoleError, UserNotFoundError } from '../../domain/errors';
import type { UploaderValidatorAssignment } from '../../domain/entities/assignment.entity';

export class AssignUploaderUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(
    input: AssignUploaderInput,
  ): Promise<Result<UploaderValidatorAssignment, DomainError>> {
    const [uploader, validator] = await Promise.all([
      this.userRepo.findById(input.uploaderId),
      this.userRepo.findById(input.validatorId),
    ]);

    if (!uploader) return err(new UserNotFoundError(input.uploaderId));
    if (!validator) return err(new UserNotFoundError(input.validatorId));

    if (uploader.getRole() !== 'uploader') {
      return err(
        new InvalidRoleError(
          `User ${input.uploaderId} is not an uploader (role: ${uploader.getRole()})`,
        ),
      );
    }
    if (validator.getRole() !== 'validator') {
      return err(
        new InvalidRoleError(
          `User ${input.validatorId} is not a validator (role: ${validator.getRole()})`,
        ),
      );
    }

    const assignment = await this.assignmentRepo.assignUploaderToValidator(
      input.uploaderId,
      input.validatorId,
      input.adminId,
    );

    return ok(assignment);
  }
}
