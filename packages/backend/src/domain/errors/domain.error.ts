export abstract class DomainError {
  abstract readonly code: string;

  constructor(public readonly message: string) {}
}
