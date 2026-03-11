import { describe, it, expect } from 'vitest';
import { InvoiceAmount } from '../invoice-amount.vo';
import { InvalidInvoiceAmountError } from '../../errors';

describe('InvoiceAmount', () => {
  describe('create', () => {
    it('should create a valid amount for a positive integer', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(100);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().getValue()).toBe(100);
    });

    it('should create a valid amount for a positive number with 1 decimal', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(99.9);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().getValue()).toBe(99.9);
    });

    it('should create a valid amount for a positive number with 2 decimals', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(49.99);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().getValue()).toBe(49.99);
    });

    it('should return error when amount is zero', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(0);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidInvoiceAmountError,
      );
    });

    it('should return error when amount is negative', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(-10);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidInvoiceAmountError,
      );
    });

    it('should return error when amount has more than 2 decimal places', () => {
      // Arrange & Act
      const result = InvoiceAmount.create(10.999);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidInvoiceAmountError,
      );
    });
  });

  describe('equals', () => {
    it('should be equal when both have the same value', () => {
      // Arrange
      const a = InvoiceAmount.create(100)._unsafeUnwrap();
      const b = InvoiceAmount.create(100)._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      // Arrange
      const a = InvoiceAmount.create(100)._unsafeUnwrap();
      const b = InvoiceAmount.create(200)._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });
});
