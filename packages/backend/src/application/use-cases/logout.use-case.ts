import { ok, Result } from 'neverthrow';
import { TokenStorePort } from '../ports/token-store.port';
import { LogoutInput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';

export class LogoutUseCase {
  constructor(private readonly tokenStore: TokenStorePort) {}

  async execute(input: LogoutInput): Promise<Result<void, DomainError>> {
    await this.tokenStore.delete(input.userId);
    return ok(undefined);
  }
}
