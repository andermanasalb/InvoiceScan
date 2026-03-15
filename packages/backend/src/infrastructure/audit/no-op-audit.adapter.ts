import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuditPort, AuditEntryInput } from '../../application/ports/audit.port';

export const AUDIT_TOKEN = 'AUDIT_TOKEN';

/**
 * NoOpAuditAdapter
 *
 * A temporary implementation of AuditPort that logs the audit entry
 * but does not persist it to the database.
 *
 * Why does this exist?
 * The real AuditEventTypeOrmRepository already exists (FASE 3), but wiring
 * it as the AuditPort implementation requires the full DatabaseModule which
 * pulls in a live PostgreSQL connection — making it hard to test the upload
 * endpoint in isolation.
 *
 * This adapter lets FASE 4 tests run without a database. In FASE 9, when
 * we wire up the full application, this will be replaced by the real
 * TypeORM-backed implementation.
 */
@Injectable()
export class NoOpAuditAdapter implements AuditPort {
  constructor(
    @InjectPinoLogger(NoOpAuditAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  record(entry: AuditEntryInput): Promise<void> {
    this.logger.info({ entry }, 'Audit event (no-op)');
    return Promise.resolve();
  }
}
