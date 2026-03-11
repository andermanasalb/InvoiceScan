import { AuditEvent } from '../../../domain/entities/audit-event.entity';
import { AuditEventOrmEntity } from '../entities/audit-event.orm-entity';

export class AuditEventMapper {
  /**
   * Converts a TypeORM ORM entity (from DB) into a domain AuditEvent.
   * Uses reconstruct() — no validation, data is trusted from our own DB.
   */
  static toDomain(orm: AuditEventOrmEntity): AuditEvent {
    return AuditEvent.reconstruct({
      id: orm.id,
      userId: orm.userId,
      action: orm.action,
      resourceId: orm.resourceId,
      ip: orm.ip,
      timestamp: orm.timestamp,
    });
  }

  /**
   * Converts a domain AuditEvent into a TypeORM ORM entity ready to be saved.
   */
  static toOrm(domain: AuditEvent): AuditEventOrmEntity {
    const orm = new AuditEventOrmEntity();
    orm.id = domain.getId();
    orm.userId = domain.getUserId();
    orm.action = domain.getAction();
    orm.resourceId = domain.getResourceId();
    orm.ip = domain.getIp();
    orm.timestamp = domain.getTimestamp();
    return orm;
  }
}
