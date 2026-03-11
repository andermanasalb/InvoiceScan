import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../roles.decorator';
import { UserRole } from '../../../../domain/entities/user.entity';
import type { ExecutionContext } from '@nestjs/common';

const makeContext = (userRole: string, handler = {}): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: 'u1', role: userRole } }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no @Roles() decorator is set', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext(UserRole.UPLOADER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user role is in the required list', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.APPROVER,
      UserRole.ADMIN,
    ]);
    const ctx = makeContext(UserRole.APPROVER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user role is not in the required list', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.APPROVER,
    ]);
    const ctx = makeContext(UserRole.UPLOADER);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
