import { describe, it, expect } from 'vitest';
import { ProviderName } from '../provider-name.vo';
import { InvalidProviderNameError } from '../../errors';

describe('ProviderName', () => {
  describe('create', () => {
    it('should create a valid provider name', () => {
      // Arrange & Act
      const result = ProviderName.create('Telefonica');

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().getValue()).toBe('Telefonica');
    });

    it('should create a valid provider name with exactly 100 characters', () => {
      // Arrange
      const name = 'A'.repeat(100);

      // Act
      const result = ProviderName.create(name);

      // Assert
      expect(result.isOk()).toBe(true);
    });

    it('should return error for empty string', () => {
      // Arrange & Act
      const result = ProviderName.create('');

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidProviderNameError,
      );
    });

    it('should return error for whitespace only string', () => {
      // Arrange & Act
      const result = ProviderName.create('   ');

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidProviderNameError,
      );
    });

    it('should return error for name longer than 100 characters', () => {
      // Arrange
      const name = 'A'.repeat(101);

      // Act
      const result = ProviderName.create(name);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidProviderNameError,
      );
    });
  });

  describe('equals', () => {
    it('should be equal when both have the same value', () => {
      // Arrange
      const a = ProviderName.create('Amazon')._unsafeUnwrap();
      const b = ProviderName.create('Amazon')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      // Arrange
      const a = ProviderName.create('Amazon')._unsafeUnwrap();
      const b = ProviderName.create('Telefonica')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });
});
