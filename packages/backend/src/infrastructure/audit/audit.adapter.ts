import { randomUUID } from 'crypto';
import { AuditPort, AuditEntryInput } from '../../application/ports/audit.port';
import { AuditEventRepository } from '../../domain/repositories/audit-event.repository';
import { AuditEvent } from '../../domain/entities';

export const AUDIT_PORT_TOKEN = 'AuditPort';

export class AuditAdapter implements AuditPort {
  constructor(private readonly auditRepo: AuditEventRepository) {}

  async record(entry: AuditEntryInput): Promise<void> {
    const result = AuditEvent.create({
      id: randomUUID(),
      userId: entry.userId,
      action: entry.action,
      resourceId: entry.resourceId,
      ip: entry.ip ?? 'unknown',
      timestamp: new Date(),
    });

    // If create fails (missing userId/action), skip silently rather than crashing
    if (result.isErr()) return;

    await this.auditRepo.save(result.value);
  }
}
