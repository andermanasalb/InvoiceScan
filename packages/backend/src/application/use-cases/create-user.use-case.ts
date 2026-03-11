import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { UserRepository } from '../../domain/repositories';
import { CreateUserInput, CreateUserOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { UserAlreadyExistsError } from '../../domain/errors';
import { User } from '../../domain/entities';

export class CreateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(
    input: CreateUserInput,
  ): Promise<Result<CreateUserOutput, DomainError>> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) return err(new UserAlreadyExistsError(input.email));

    const userResult = User.create({
      id: randomUUID(),
      email: input.email,
      role: input.role,
      createdAt: new Date(),
    });

    if (userResult.isErr()) return err(userResult.error);
    const user = userResult.value;

    await this.userRepo.save(user);

    return ok({
      userId: user.getId(),
      email: user.getEmail(),
      role: user.getRole(),
      createdAt: user.getCreatedAt(),
    });
  }
}
