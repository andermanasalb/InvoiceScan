import { DomainError } from './domain.error';

export class ProviderNotFoundError extends DomainError {
  readonly code = 'PROVIDER_NOT_FOUND';

  constructor(providerName: string) {
    super(`Provider ${providerName} not found`);
  }
}

export class ProviderAlreadyExistsError extends DomainError {
  readonly code = 'PROVIDER_ALREADY_EXISTS';

  constructor(providerName: string) {
    super(`Provider ${providerName} already exists`);
  }
}
