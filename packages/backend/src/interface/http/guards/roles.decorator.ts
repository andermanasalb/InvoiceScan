import { SetMetadata } from '@nestjs/common';
import { UserRoleValue } from '../../../domain/entities/user.entity';

export const ROLES_KEY = 'roles';

/** Attach allowed roles to a route handler */
export const Roles = (...roles: UserRoleValue[]) =>
  SetMetadata(ROLES_KEY, roles);
