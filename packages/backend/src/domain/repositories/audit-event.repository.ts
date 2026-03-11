import { AuditEvent } from '../entities';

export interface AuditEventFilters {
  userId?: string;
  resourceId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export interface AuditEventRepository {
  findById(id: string): Promise<AuditEvent | null>;
  findAll(filters: AuditEventFilters): Promise<AuditEvent[]>;
  save(event: AuditEvent): Promise<void>;
}
