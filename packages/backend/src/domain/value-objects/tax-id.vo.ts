import { ok, err, Result } from 'neverthrow';
import { InvalidTaxIdError } from '../errors';

// NIF: 8 digits followed by 1 uppercase letter (e.g. 12345678A)
const NIF_REGEX = /^\d{8}[A-Z]$/;

// CIF: 1 uppercase letter followed by 7 digits (e.g. A1234567)
const CIF_REGEX = /^[A-Z]\d{7}$/;

export class TaxId {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<TaxId, InvalidTaxIdError> {
    if (!NIF_REGEX.test(value) && !CIF_REGEX.test(value)) {
      return err(new InvalidTaxIdError(value));
    }
    return ok(new TaxId(value));
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TaxId): boolean {
    return this.value === other.value;
  }
}
