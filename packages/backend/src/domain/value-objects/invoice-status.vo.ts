import { ok, err, Result } from 'neverthrow';
import { InvalidInvoiceStatusError } from '../errors';

export const InvoiceStatusEnum = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  EXTRACTED: 'EXTRACTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  READY_FOR_VALIDATION: 'READY_FOR_VALIDATION',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type InvoiceStatusValue =
  (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

const VALID_STATUSES = new Set<string>(Object.values(InvoiceStatusEnum));

export class InvoiceStatus {
  private constructor(private readonly value: InvoiceStatusValue) {}

  static create(
    value: string,
  ): Result<InvoiceStatus, InvalidInvoiceStatusError> {
    if (!VALID_STATUSES.has(value)) {
      return err(new InvalidInvoiceStatusError(value));
    }
    return ok(new InvoiceStatus(value as InvoiceStatusValue));
  }

  getValue(): InvoiceStatusValue {
    return this.value;
  }

  equals(other: InvoiceStatus): boolean {
    return this.value === other.value;
  }
}
