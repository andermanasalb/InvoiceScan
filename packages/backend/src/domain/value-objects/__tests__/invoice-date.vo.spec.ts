import { describe, it, expect } from 'vitest';
import { InvoiceDate } from '../invoice-date.vo';
import { InvalidInvoiceDateError } from '../../errors';

describe('InvoiceDate', () => {
  describe('create', () => {
    it('should create a valid date for today', () => {
      // Arrange
      const today = new Date();

      // Act
      const result = InvoiceDate.create(today);

      // Assert
      expect(result.isOk()).toBe(true);
    });

    it('should create a valid date for a past date', () => {
      // Arrange
      const pastDate = new Date('2024-01-15');

      // Act
      const result = InvoiceDate.create(pastDate);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().getValue()).toEqual(pastDate);
    });

    it('should return error for a future date', () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      // Act
      const result = InvoiceDate.create(futureDate);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(InvalidInvoiceDateError);
    });

    it('should return error for tomorrow', () => {
      // Arrange
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Act
      const result = InvoiceDate.create(tomorrow);

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should be equal when both have the same date', () => {
      // Arrange
      const date = new Date('2024-06-01');
      const a = InvoiceDate.create(date)._unsafeUnwrap();
      const b = InvoiceDate.create(new Date('2024-06-01'))._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal when dates differ', () => {
      // Arrange
      const a = InvoiceDate.create(new Date('2024-06-01'))._unsafeUnwrap();
      const b = InvoiceDate.create(new Date('2024-06-02'))._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });
});
