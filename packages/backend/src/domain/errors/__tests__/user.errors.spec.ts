import { describe, it, expect } from 'vitest';
import { UserNotFoundError, UnauthorizedError } from '../user.errors';
import { DomainError } from '../domain.error';

describe('User Domain Errors', () => {
  describe('UserNotFoundError', () => {
    it('should have correct code and include user id in message', () => {
      // Arrange & Act
      const error = new UserNotFoundError('user-789');

      // Assert
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.message).toContain('user-789');
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('UnauthorizedError', () => {
    it('should have correct code and include action in message', () => {
      // Arrange & Act
      const error = new UnauthorizedError('approve invoices');

      // Assert
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toContain('approve invoices');
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should expose the action that was denied', () => {
      // Arrange & Act
      const error = new UnauthorizedError('delete provider');

      // Assert
      expect(error.action).toBe('delete provider');
    });
  });
});
