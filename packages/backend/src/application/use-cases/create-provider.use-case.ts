import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { ProviderRepository } from '../../domain/repositories';
import { CreateProviderInput, CreateProviderOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { ProviderAlreadyExistsError } from '../../domain/errors';
import { Provider } from '../../domain/entities';
import { ProviderName } from '../../domain/value-objects';

export class CreateProviderUseCase {
  constructor(private readonly providerRepo: ProviderRepository) {}

  async execute(
    input: CreateProviderInput,
  ): Promise<Result<CreateProviderOutput, DomainError>> {
    const existing = await this.providerRepo.findByName(input.name);
    if (existing) return err(new ProviderAlreadyExistsError(input.name));

    const nameResult = ProviderName.create(input.name);
    if (nameResult.isErr()) return err(nameResult.error);

    const providerResult = Provider.create({
      id: randomUUID(),
      name: nameResult.value,
      adapterType: input.adapterType,
      createdAt: new Date(),
    });

    if (providerResult.isErr()) return err(providerResult.error);
    const provider = providerResult.value;

    await this.providerRepo.save(provider);

    return ok({
      providerId: provider.getId(),
      name: provider.getName().getValue(),
      adapterType: provider.getAdapterType(),
      createdAt: provider.getCreatedAt(),
    });
  }
}
