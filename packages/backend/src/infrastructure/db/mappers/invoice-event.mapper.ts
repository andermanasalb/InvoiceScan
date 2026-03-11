import { InvoiceEvent } from '../../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import { InvoiceEventOrmEntity } from '../entities/invoice-event.orm-entity';

type InvoiceStatusValue =
  (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

export class InvoiceEventMapper {
  /**
   * Converts a TypeORM ORM entity (from DB) into a domain InvoiceEvent.
   * Uses reconstruct() — no validation, data is trusted from our own DB.
   */
  static toDomain(orm: InvoiceEventOrmEntity): InvoiceEvent {
    return InvoiceEvent.reconstruct({
      id: orm.id,
      invoiceId: orm.invoiceId,
      from: orm.fromStatus as InvoiceStatusValue,
      to: orm.toStatus as InvoiceStatusValue,
      userId: orm.userId,
      timestamp: orm.timestamp,
    });
  }

  /**
   * Converts a domain InvoiceEvent into a TypeORM ORM entity ready to be saved.
   */
  static toOrm(domain: InvoiceEvent): InvoiceEventOrmEntity {
    const orm = new InvoiceEventOrmEntity();
    orm.id = domain.getId();
    orm.invoiceId = domain.getInvoiceId();
    orm.fromStatus = domain.getFrom();
    orm.toStatus = domain.getTo();
    orm.userId = domain.getUserId();
    orm.timestamp = domain.getTimestamp();
    return orm;
  }
}
