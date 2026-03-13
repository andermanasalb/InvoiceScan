import { DomainError } from './domain.error';

export class InvoiceNotFoundError extends DomainError {
  readonly code = 'INVOICE_NOT_FOUND';

  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} not found`);
  }
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';

  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid state transition from ${from} to ${to}`);
  }
}

export class InvoiceAlreadyProcessingError extends DomainError {
  readonly code = 'INVOICE_ALREADY_PROCESSING';

  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} is already being processed`);
  }
}

export class ExtractionFailedError extends DomainError {
  readonly code = 'EXTRACTION_FAILED';

  constructor(reason: string) {
    super(`Data extraction failed: ${reason}`);
  }
}

export class ValidationFailedError extends DomainError {
  readonly code = 'VALIDATION_FAILED';

  constructor(public readonly errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
  }
}

export class InvalidFieldError extends DomainError {
  readonly code = 'INVALID_FIELD';

  constructor(
    public readonly field: string,
    reason: string,
  ) {
    super(`Invalid field '${field}': ${reason}`);
  }
}

export class SelfActionNotAllowedError extends DomainError {
  readonly code = 'SELF_ACTION_NOT_ALLOWED';

  constructor() {
    super('You cannot perform this action on your own invoice');
  }
}
