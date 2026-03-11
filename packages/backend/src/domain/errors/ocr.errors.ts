import { DomainError } from './domain.error';

export class OcrError extends DomainError {
  readonly code = 'OCR_FAILED';

  constructor(reason: string) {
    super(`OCR extraction failed: ${reason}`);
  }
}
