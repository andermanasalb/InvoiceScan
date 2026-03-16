import { ok, err, Result } from 'neverthrow';
import { UserRepository } from '../../domain/repositories';
import { DomainError } from '../../domain/errors/domain.error';
import { UserNotFoundError } from '../../domain/errors';

export interface DeleteUserInput {
  userId: string;
  requesterId: string;
}

export class DeleteUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: DeleteUserInput): Promise<Result<void, DomainError>> {
    if (input.userId === input.requesterId) {
      return err(new UserNotFoundError('Cannot delete your own account'));
    }

    const user = await this.userRepo.findById(input.userId);
    if (!user) return err(new UserNotFoundError(input.userId));

    await this.userRepo.delete(input.userId);
    return ok(undefined);
  }
}
