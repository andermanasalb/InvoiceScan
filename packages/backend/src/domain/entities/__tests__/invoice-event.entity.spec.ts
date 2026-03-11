import { describe, it, expect } from 'vitest';
import { InvoiceEvent } from '../invoice-event.entity';
import { InvoiceStatusEnum } from '../../value-objects';

function makeValidProps() {
  return {
    id: 'inevt-001',
    invoiceId: 'inv-001',
    from: InvoiceStatusEnum.PENDING,
    to: InvoiceStatusEnum.PROCESSING,
    userId: 'user-001',
    timestamp: new Date('2024-06-01T10:00:00Z'),
  };
}

describe('InvoiceEvent', () => {
  describe('create', () => {
    it('should create an invoice event with valid props', () => {
      // Arrange & Act
      const result = InvoiceEvent.create(makeValidProps());

      // Assert
      expect(result.isOk()).toBe(true);
      const event = result._unsafeUnwrap();
      expect(event.getId()).toBe('inevt-001');
      expect(event.getInvoiceId()).toBe('inv-001');
      expect(event.getFrom()).toBe(InvoiceStatusEnum.PENDING);
      expect(event.getTo()).toBe(InvoiceStatusEnum.PROCESSING);
      expect(event.getUserId()).toBe('user-001');
      expect(event.getTimestamp()).toEqual(new Date('2024-06-01T10:00:00Z'));
    });

    it('should return error when id is empty', () => {
      // Arrange & Act
      const result = InvoiceEvent.create({ ...makeValidProps(), id: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when invoiceId is empty', () => {
      // Arrange & Act
      const result = InvoiceEvent.create({
        ...makeValidProps(),
        invoiceId: '',
      });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when from equals to', () => {
      // Arrange & Act
      const result = InvoiceEvent.create({
        ...makeValidProps(),
        from: InvoiceStatusEnum.PENDING,
        to: InvoiceStatusEnum.PENDING,
      });

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('immutability', () => {
    it('should only expose getters, no mutation methods', () => {
      // Arrange
      const event = InvoiceEvent.create(makeValidProps())._unsafeUnwrap();

      // Assert
      expect(typeof event.getId).toBe('function');
      expect(typeof event.getInvoiceId).toBe('function');
      expect(typeof event.getFrom).toBe('function');
      expect(typeof event.getTo).toBe('function');
      expect(typeof event.getUserId).toBe('function');
      expect(typeof event.getTimestamp).toBe('function');
    });
  });
});
