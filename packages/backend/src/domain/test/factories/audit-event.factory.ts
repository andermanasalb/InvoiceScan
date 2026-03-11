import { randomUUID } from 'crypto';
import { AuditEvent, CreateAuditEventProps } from '../../entities/audit-event.entity';

const defaultProps = (): CreateAuditEventProps => ({
  id: 'audit-' + randomUUID(),
  userId: 'user-456',
  action: 'upload',
  resourceId: 'inv-123',
  ip: '127.0.0.1',
  timestamp: new Date('2025-01-15'),
});

export const createAuditEvent = (overrides?: Partial<CreateAuditEventProps>): AuditEvent => {
  const props = { ...defaultProps(), ...overrides };
  return AuditEvent.create(props)._unsafeUnwrap();
};
