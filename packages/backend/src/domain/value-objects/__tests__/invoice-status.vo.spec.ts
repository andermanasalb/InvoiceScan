import { describe, it, expect } from 'vitest';
import { InvoiceStatus, InvoiceStatusEnum } from '../invoice-status.vo';
import { InvalidInvoiceStatusError } from '../../errors';

describe('InvoiceStatus', () => {
  describe('create', () => {
    it('should create a valid status for each allowed value', () => {
      // Arrange
      const validStatuses = [
        'PENDING',
        'PROCESSING',
        'EXTRACTED',
        'VALIDATION_FAILED',
        'READY_FOR_APPROVAL',
        'APPROVED',
        'REJECTED',
      ];

      validStatuses.forEach((status) => {
        // Act
        const result = InvoiceStatus.create(status);

        // Assert
        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().getValue()).toBe(status);
      });
    });

    it('should return error for unknown status', () => {
      // Arrange & Act
      const result = InvoiceStatus.create('UNKNOWN');

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidInvoiceStatusError,
      );
    });

    it('should return error for empty string', () => {
      // Arrange & Act
      const result = InvoiceStatus.create('');

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should be equal when both have the same value', () => {
      // Arrange
      const a = InvoiceStatus.create('PENDING')._unsafeUnwrap();
      const b = InvoiceStatus.create('PENDING')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      // Arrange
      const a = InvoiceStatus.create('PENDING')._unsafeUnwrap();
      const b = InvoiceStatus.create('APPROVED')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('InvoiceStatusEnum', () => {
    it('should expose all valid statuses as constants', () => {
      // Assert
      expect(InvoiceStatusEnum.PENDING).toBe('PENDING');
      expect(InvoiceStatusEnum.PROCESSING).toBe('PROCESSING');
      expect(InvoiceStatusEnum.EXTRACTED).toBe('EXTRACTED');
      expect(InvoiceStatusEnum.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(InvoiceStatusEnum.READY_FOR_APPROVAL).toBe('READY_FOR_APPROVAL');
      expect(InvoiceStatusEnum.APPROVED).toBe('APPROVED');
      expect(InvoiceStatusEnum.REJECTED).toBe('REJECTED');
    });
  });
});
