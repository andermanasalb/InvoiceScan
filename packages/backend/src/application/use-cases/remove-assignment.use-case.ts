import { ok, Result } from 'neverthrow';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import type { RemoveAssignmentInput } from '../dtos/assignment.dto';
import { DomainError } from '../../domain/errors/domain.error';

export class RemoveAssignmentUseCase {
  constructor(private readonly assignmentRepo: AssignmentRepository) {}

  async execute(
    input: RemoveAssignmentInput,
  ): Promise<Result<void, DomainError>> {
    if (input.type === 'uploader') {
      await this.assignmentRepo.removeUploaderAssignment(input.assigneeId);
    } else {
      await this.assignmentRepo.removeValidatorAssignment(input.assigneeId);
    }
    return ok(undefined);
  }
}
