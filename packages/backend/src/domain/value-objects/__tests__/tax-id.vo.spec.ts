import { describe, it, expect } from 'vitest';
import { TaxId } from '../tax-id.vo';
import { InvalidTaxIdError } from '../../errors';

describe('TaxId', () => {
  describe('create', () => {
    describe('valid NIF formats', () => {
      it('should accept a valid NIF (8 digits + uppercase letter)', () => {
        // Arrange & Act
        const result = TaxId.create('12345678A');

        // Assert
        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().getValue()).toBe('12345678A');
      });

      it('should accept another valid NIF', () => {
        // Arrange & Act
        const result = TaxId.create('87654321Z');

        // Assert
        expect(result.isOk()).toBe(true);
      });
    });

    describe('valid CIF formats', () => {
      it('should accept a valid CIF (uppercase letter + 7 digits)', () => {
        // Arrange & Act
        const result = TaxId.create('A1234567');

        // Assert
        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().getValue()).toBe('A1234567');
      });

      it('should accept a CIF with different org letter', () => {
        // Arrange & Act
        const result = TaxId.create('B9876543');

        // Assert
        expect(result.isOk()).toBe(true);
      });
    });

    describe('invalid formats', () => {
      it('should return error for empty string', () => {
        // Arrange & Act
        const result = TaxId.create('');

        // Assert
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(InvalidTaxIdError);
      });

      it('should return error for NIF with lowercase letter', () => {
        // Arrange & Act
        const result = TaxId.create('12345678a');

        // Assert
        expect(result.isErr()).toBe(true);
      });

      it('should return error for NIF with wrong digit count', () => {
        // Arrange & Act
        const result = TaxId.create('1234567A');

        // Assert
        expect(result.isErr()).toBe(true);
      });

      it('should return error for a random string', () => {
        // Arrange & Act
        const result = TaxId.create('INVALID');

        // Assert
        expect(result.isErr()).toBe(true);
      });

      it('should return error for all digits with no letter', () => {
        // Arrange & Act
        const result = TaxId.create('123456789');

        // Assert
        expect(result.isErr()).toBe(true);
      });
    });
  });

  describe('equals', () => {
    it('should be equal when both have the same value', () => {
      // Arrange
      const a = TaxId.create('12345678A')._unsafeUnwrap();
      const b = TaxId.create('12345678A')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      // Arrange
      const a = TaxId.create('12345678A')._unsafeUnwrap();
      const b = TaxId.create('A1234567')._unsafeUnwrap();

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });
});
