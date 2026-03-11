import { ok, err, Result } from 'neverthrow';
import { InvalidInvoiceDateError } from '../errors';

export class InvoiceDate {
  private constructor(private readonly value: Date) {}

  static create(value: Date): Result<InvoiceDate, InvalidInvoiceDateError> {
    const now = new Date();
    // Strip time — compare date only
    const inputDay = new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
    );
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (inputDay > today) {
      return err(
        new InvalidInvoiceDateError('Invoice date cannot be in the future'),
      );
    }
    return ok(new InvoiceDate(value));
  }

  getValue(): Date {
    return this.value;
  }

  equals(other: InvoiceDate): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}
