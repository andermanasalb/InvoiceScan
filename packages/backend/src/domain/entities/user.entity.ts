import { ok, err, Result } from 'neverthrow';
import { DomainError } from '../errors/domain.error';
import { UnauthorizedError } from '../errors';

export const UserRole = {
  UPLOADER: 'uploader',
  VALIDATOR: 'validator',
  APPROVER: 'approver',
  ADMIN: 'admin',
} as const;

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole];

const VALID_ROLES = new Set<string>(Object.values(UserRole));

export interface CreateUserProps {
  id: string;
  email: string;
  role: UserRoleValue;
  createdAt: Date;
}

export class User {
  private constructor(
    private readonly id: string,
    private readonly email: string,
    private readonly role: UserRoleValue,
    private readonly createdAt: Date,
  ) {}

  static create(props: CreateUserProps): Result<User, DomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new UnauthorizedError('User id cannot be empty'));
    }
    if (!props.email || !props.email.includes('@')) {
      return err(new UnauthorizedError('User email is invalid'));
    }
    if (!VALID_ROLES.has(props.role)) {
      return err(new UnauthorizedError(`Invalid role: ${props.role}`));
    }
    return ok(new User(props.id, props.email, props.role, props.createdAt));
  }

  getId(): string {
    return this.id;
  }
  getEmail(): string {
    return this.email;
  }
  getRole(): UserRoleValue {
    return this.role;
  }
  getCreatedAt(): Date {
    return this.createdAt;
  }
}
