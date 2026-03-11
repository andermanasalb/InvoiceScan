import { DomainError } from './domain.error';

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(public readonly action: string) {
    super(`Unauthorized to perform action: ${action}`);
  }
}

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor(email: string) {
    super(`User with email ${email} already exists`);
  }
}
