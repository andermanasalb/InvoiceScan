export interface AuditEntryInput {
  action: string;
  resourceId: string;
  userId: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditPort {
  record(entry: AuditEntryInput): Promise<void>;
}
