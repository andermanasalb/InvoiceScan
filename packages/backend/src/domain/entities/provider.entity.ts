import { ok, err, Result } from 'neverthrow';
import { ProviderName } from '../value-objects';
import { DomainError } from '../errors/domain.error';
import { InvalidProviderNameError } from '../errors';

export interface CreateProviderProps {
  id: string;
  name: ProviderName;
  adapterType: string;
  createdAt: Date;
}

export class Provider {
  private constructor(
    private readonly id: string,
    private readonly name: ProviderName,
    private readonly adapterType: string,
    private readonly createdAt: Date,
  ) {}

  static create(props: CreateProviderProps): Result<Provider, DomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new InvalidProviderNameError('Provider id cannot be empty'));
    }
    if (!props.adapterType || props.adapterType.trim().length === 0) {
      return err(
        new InvalidProviderNameError('Provider adapterType cannot be empty'),
      );
    }
    return ok(
      new Provider(props.id, props.name, props.adapterType, props.createdAt),
    );
  }

  /**
   * Reconstructs a Provider from persisted data (e.g. from the database).
   * Skips validation — data is assumed to be already valid.
   */
  static reconstruct(props: CreateProviderProps): Provider {
    return new Provider(
      props.id,
      props.name,
      props.adapterType,
      props.createdAt,
    );
  }

  getId(): string {
    return this.id;
  }
  getName(): ProviderName {
    return this.name;
  }
  getAdapterType(): string {
    return this.adapterType;
  }
  getCreatedAt(): Date {
    return this.createdAt;
  }
}
