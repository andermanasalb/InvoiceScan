import { ok, err, Result } from 'neverthrow';
import { InvalidProviderNameError } from '../errors';

const MAX_LENGTH = 100;

export class ProviderName {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<ProviderName, InvalidProviderNameError> {
    if (!value || value.trim().length === 0) {
      return err(new InvalidProviderNameError('Provider name cannot be empty'));
    }
    if (value.length > MAX_LENGTH) {
      return err(
        new InvalidProviderNameError(
          `Provider name cannot exceed ${MAX_LENGTH} characters`,
        ),
      );
    }
    return ok(new ProviderName(value));
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ProviderName): boolean {
    return this.value === other.value;
  }
}
