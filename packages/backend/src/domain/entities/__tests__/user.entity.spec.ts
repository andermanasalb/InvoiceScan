import { describe, it, expect } from 'vitest';
import { User, UserRole } from '../user.entity';

function makeValidProps() {
  return {
    id: 'user-001',
    email: 'alice@example.com',
    role: UserRole.UPLOADER,
    createdAt: new Date('2024-01-01'),
  };
}

describe('User', () => {
  describe('create', () => {
    it('should create a user with valid props', () => {
      // Arrange & Act
      const result = User.create(makeValidProps());

      // Assert
      expect(result.isOk()).toBe(true);
      const user = result._unsafeUnwrap();
      expect(user.getId()).toBe('user-001');
      expect(user.getEmail()).toBe('alice@example.com');
      expect(user.getRole()).toBe(UserRole.UPLOADER);
    });

    it('should create a user for each valid role', () => {
      // Arrange
      const roles = [
        UserRole.UPLOADER,
        UserRole.VALIDATOR,
        UserRole.APPROVER,
        UserRole.ADMIN,
      ];

      roles.forEach((role) => {
        // Act
        const result = User.create({ ...makeValidProps(), role });

        // Assert
        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().getRole()).toBe(role);
      });
    });

    it('should return error when id is empty', () => {
      // Arrange & Act
      const result = User.create({ ...makeValidProps(), id: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when email is empty', () => {
      // Arrange & Act
      const result = User.create({ ...makeValidProps(), email: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when email has no @ symbol', () => {
      // Arrange & Act
      const result = User.create({ ...makeValidProps(), email: 'notanemail' });

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('UserRole', () => {
    it('should expose all valid roles as constants', () => {
      // Assert
      expect(UserRole.UPLOADER).toBe('uploader');
      expect(UserRole.VALIDATOR).toBe('validator');
      expect(UserRole.APPROVER).toBe('approver');
      expect(UserRole.ADMIN).toBe('admin');
    });
  });
});
