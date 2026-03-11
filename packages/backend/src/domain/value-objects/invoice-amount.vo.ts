import { ok, err, Result } from 'neverthrow';
import { InvalidInvoiceAmountError } from '../errors';

function hasMaxTwoDecimals(value: number): boolean {
  const parts = value.toString().split('.');
  return parts.length === 1 || parts[1].length <= 2;
}

export class InvoiceAmount {
  private constructor(private readonly value: number) {}

  static create(
    value: number,
  ): Result<InvoiceAmount, InvalidInvoiceAmountError> {
    if (value <= 0) {
      return err(new InvalidInvoiceAmountError(value));
    }
    if (!hasMaxTwoDecimals(value)) {
      return err(new InvalidInvoiceAmountError(value));
    }
    return ok(new InvoiceAmount(value));
  }

  getValue(): number {
    return this.value;
  }

  equals(other: InvoiceAmount): boolean {
    return this.value === other.value;
  }
}
