import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../../domain/repositories';
import { UserCredentialRepository } from '../../domain/repositories/user-credential.repository';
import { CreateUserInput, CreateUserOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { UserAlreadyExistsError } from '../../domain/errors';
import { User } from '../../domain/entities';

const BCRYPT_SALT_ROUNDS = 12;

export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly credentialRepo: UserCredentialRepository,
  ) {}

  async execute(
    input: CreateUserInput,
  ): Promise<Result<CreateUserOutput, DomainError>> {
    // 1. Verificar que el email no está en uso
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) return err(new UserAlreadyExistsError(input.email));

    // 2. Crear la entity de dominio User
    const userResult = User.create({
      id: randomUUID(),
      email: input.email,
      role: input.role,
      createdAt: new Date(),
    });
    if (userResult.isErr()) return err(userResult.error);
    const user = userResult.value;

    // 3. Hashear la contraseña con bcrypt (salt rounds 12)

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // 4. Persistir usuario y credencial
    await this.userRepo.save(user);
    await this.credentialRepo.save({
      id: randomUUID(),
      userId: user.getId(),
      passwordHash,
      createdAt: new Date(),
    });

    return ok({
      userId: user.getId(),
      email: user.getEmail(),
      role: user.getRole(),
      createdAt: user.getCreatedAt(),
    });
  }
}
