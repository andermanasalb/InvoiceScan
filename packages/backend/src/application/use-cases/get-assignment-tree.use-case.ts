import { ok, Result } from 'neverthrow';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import type { AssignmentTree } from '../../domain/entities/assignment.entity';
import { DomainError } from '../../domain/errors/domain.error';

export class GetAssignmentTreeUseCase {
  constructor(private readonly assignmentRepo: AssignmentRepository) {}

  async execute(): Promise<Result<AssignmentTree, DomainError>> {
    const tree = await this.assignmentRepo.getFullTree();
    return ok(tree);
  }
}
