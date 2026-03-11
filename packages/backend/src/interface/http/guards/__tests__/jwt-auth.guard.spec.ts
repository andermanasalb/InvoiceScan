import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();

  describe('handleRequest', () => {
    it('should return the user when no error and user is present', () => {
      const user = { userId: 'u1', role: 'uploader' };
      expect(guard.handleRequest(null, user)).toBe(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when an error is provided', () => {
      expect(() =>
        guard.handleRequest(new Error('token expired'), null),
      ).toThrow(UnauthorizedException);
    });
  });
});
