import { DomainError } from './domain.error';

export class InvalidInvoiceAmountError extends DomainError {
  readonly code = 'INVALID_INVOICE_AMOUNT';

  constructor(value: number) {
    super(
      `Invalid invoice amount: ${value}. Must be greater than 0 with at most 2 decimal places`,
    );
  }
}

export class InvalidInvoiceStatusError extends DomainError {
  readonly code = 'INVALID_INVOICE_STATUS';

  constructor(value: string) {
    super(`Invalid invoice status: ${value}`);
  }
}

export class InvalidInvoiceDateError extends DomainError {
  readonly code = 'INVALID_INVOICE_DATE';

  constructor(reason: string) {
    super(`Invalid invoice date: ${reason}`);
  }
}

export class InvalidTaxIdError extends DomainError {
  readonly code = 'INVALID_TAX_ID';

  constructor(value: string) {
    super(
      `Invalid tax ID: ${value}. Must be a valid NIF (12345678A) or CIF (A1234567)`,
    );
  }
}

export class InvalidProviderNameError extends DomainError {
  readonly code = 'INVALID_PROVIDER_NAME';

  constructor(reason: string) {
    super(`Invalid provider name: ${reason}`);
  }
}
