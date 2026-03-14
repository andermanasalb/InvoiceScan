import { ok, Result } from 'neverthrow';
import type { UserRepository } from '../../domain/repositories';
import type { ListUsersInput, ListUsersOutput } from '../dtos/list-users.dto';
import { DomainError } from '../../domain/errors/domain.error';

export class ListUsersUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(
    input: ListUsersInput,
  ): Promise<Result<ListUsersOutput, DomainError>> {
    const users = await this.userRepo.findAll(input.role);
    return ok({
      users: users.map((u) => ({
        userId: u.getId(),
        email: u.getEmail(),
        role: u.getRole() as 'uploader' | 'validator' | 'approver' | 'admin',
        createdAt: u.getCreatedAt(),
      })),
    });
  }
}
