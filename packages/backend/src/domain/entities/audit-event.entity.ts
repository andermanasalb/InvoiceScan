import { ok, err, Result } from 'neverthrow';
import { DomainError } from '../errors/domain.error';
import { InvalidStateTransitionError } from '../errors';

export interface CreateAuditEventProps {
  id: string;
  userId: string;
  action: string;
  resourceId: string;
  ip: string;
  timestamp: Date;
}

export class AuditEvent {
  private constructor(
    private readonly id: string,
    private readonly userId: string,
    private readonly action: string,
    private readonly resourceId: string,
    private readonly ip: string,
    private readonly timestamp: Date,
  ) {}

  static create(props: CreateAuditEventProps): Result<AuditEvent, DomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new InvalidStateTransitionError('', 'audit'));
    }
    if (!props.userId || props.userId.trim().length === 0) {
      return err(new InvalidStateTransitionError('', 'audit'));
    }
    if (!props.action || props.action.trim().length === 0) {
      return err(new InvalidStateTransitionError('', 'audit'));
    }
    return ok(
      new AuditEvent(
        props.id,
        props.userId,
        props.action,
        props.resourceId,
        props.ip,
        props.timestamp,
      ),
    );
  }

  /**
   * Reconstructs an AuditEvent from persisted data (e.g. from the database).
   * Skips validation — data is assumed to be already valid.
   */
  static reconstruct(props: CreateAuditEventProps): AuditEvent {
    return new AuditEvent(
      props.id,
      props.userId,
      props.action,
      props.resourceId,
      props.ip,
      props.timestamp,
    );
  }

  getId(): string {
    return this.id;
  }
  getUserId(): string {
    return this.userId;
  }
  getAction(): string {
    return this.action;
  }
  getResourceId(): string {
    return this.resourceId;
  }
  getIp(): string {
    return this.ip;
  }
  getTimestamp(): Date {
    return this.timestamp;
  }
}
