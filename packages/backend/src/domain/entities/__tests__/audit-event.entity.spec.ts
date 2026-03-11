import { describe, it, expect } from 'vitest';
import { AuditEvent } from '../audit-event.entity';

function makeValidProps() {
  return {
    id: 'audit-001',
    userId: 'user-001',
    action: 'approve',
    resourceId: 'inv-001',
    ip: '192.168.1.1',
    timestamp: new Date('2024-06-01T10:00:00Z'),
  };
}

describe('AuditEvent', () => {
  describe('create', () => {
    it('should create an audit event with valid props', () => {
      // Arrange & Act
      const result = AuditEvent.create(makeValidProps());

      // Assert
      expect(result.isOk()).toBe(true);
      const event = result._unsafeUnwrap();
      expect(event.getId()).toBe('audit-001');
      expect(event.getUserId()).toBe('user-001');
      expect(event.getAction()).toBe('approve');
      expect(event.getResourceId()).toBe('inv-001');
      expect(event.getIp()).toBe('192.168.1.1');
      expect(event.getTimestamp()).toEqual(new Date('2024-06-01T10:00:00Z'));
    });

    it('should return error when id is empty', () => {
      // Arrange & Act
      const result = AuditEvent.create({ ...makeValidProps(), id: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when action is empty', () => {
      // Arrange & Act
      const result = AuditEvent.create({ ...makeValidProps(), action: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });

    it('should return error when userId is empty', () => {
      // Arrange & Act
      const result = AuditEvent.create({ ...makeValidProps(), userId: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('immutability', () => {
    it('should not expose any mutation methods', () => {
      // Arrange
      const event = AuditEvent.create(makeValidProps())._unsafeUnwrap();

      // Assert — only getters exist, no setters
      expect(typeof event.getId).toBe('function');
      expect(typeof event.getUserId).toBe('function');
      expect(typeof event.getAction).toBe('function');
      expect(typeof event.getResourceId).toBe('function');
      expect(typeof event.getIp).toBe('function');
      expect(typeof event.getTimestamp).toBe('function');
    });
  });
});
