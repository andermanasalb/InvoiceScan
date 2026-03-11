import { DomainError } from './domain.error';

export class LLMError extends DomainError {
  readonly code = 'LLM_ERROR';

  constructor(message: string) {
    super(message);
  }
}
