import { describe, it, expect } from 'vitest';
import {
  InvoiceNotFoundError,
  InvalidStateTransitionError,
  InvoiceAlreadyProcessingError,
  ExtractionFailedError,
  ValidationFailedError,
} from '../invoice.errors';
import { DomainError } from '../domain.error';

describe('Invoice Domain Errors', () => {
  describe('InvoiceNotFoundError', () => {
    it('should have correct code and message', () => {
      // Arrange & Act
      const error = new InvoiceNotFoundError('inv-123');

      // Assert
      expect(error.code).toBe('INVOICE_NOT_FOUND');
      expect(error.message).toContain('inv-123');
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('InvalidStateTransitionError', () => {
    it('should have correct code and include both states in message', () => {
      // Arrange & Act
      const error = new InvalidStateTransitionError('APPROVED', 'PENDING');

      // Assert
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.message).toContain('APPROVED');
      expect(error.message).toContain('PENDING');
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should expose from and to states', () => {
      // Arrange & Act
      const error = new InvalidStateTransitionError('REJECTED', 'PROCESSING');

      // Assert
      expect(error.from).toBe('REJECTED');
      expect(error.to).toBe('PROCESSING');
    });
  });

  describe('InvoiceAlreadyProcessingError', () => {
    it('should have correct code and include invoice id in message', () => {
      // Arrange & Act
      const error = new InvoiceAlreadyProcessingError('inv-456');

      // Assert
      expect(error.code).toBe('INVOICE_ALREADY_PROCESSING');
      expect(error.message).toContain('inv-456');
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('ExtractionFailedError', () => {
    it('should have correct code and include reason in message', () => {
      // Arrange & Act
      const error = new ExtractionFailedError('PDF is corrupted');

      // Assert
      expect(error.code).toBe('EXTRACTION_FAILED');
      expect(error.message).toContain('PDF is corrupted');
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('ValidationFailedError', () => {
    it('should have correct code and expose validation errors', () => {
      // Arrange
      const validationErrors = ['Total is missing', 'Tax ID is invalid'];

      // Act
      const error = new ValidationFailedError(validationErrors);

      // Assert
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.errors).toEqual(validationErrors);
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should include all validation errors in message', () => {
      // Arrange & Act
      const error = new ValidationFailedError([
        'Total is missing',
        'Tax ID is invalid',
      ]);

      // Assert
      expect(error.message).toContain('Total is missing');
      expect(error.message).toContain('Tax ID is invalid');
    });
  });
});
