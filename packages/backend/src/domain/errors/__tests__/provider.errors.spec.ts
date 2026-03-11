import { describe, it, expect } from 'vitest';
import {
  ProviderNotFoundError,
  ProviderAlreadyExistsError,
} from '../provider.errors';
import { DomainError } from '../domain.error';

describe('Provider Domain Errors', () => {
  describe('ProviderNotFoundError', () => {
    it('should have correct code and include provider name in message', () => {
      // Arrange & Act
      const error = new ProviderNotFoundError('telefonica');

      // Assert
      expect(error.code).toBe('PROVIDER_NOT_FOUND');
      expect(error.message).toContain('telefonica');
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('ProviderAlreadyExistsError', () => {
    it('should have correct code and include provider name in message', () => {
      // Arrange & Act
      const error = new ProviderAlreadyExistsError('amazon');

      // Assert
      expect(error.code).toBe('PROVIDER_ALREADY_EXISTS');
      expect(error.message).toContain('amazon');
      expect(error).toBeInstanceOf(DomainError);
    });
  });
});
