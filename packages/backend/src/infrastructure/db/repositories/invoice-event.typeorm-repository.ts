import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InvoiceEvent } from '../../../domain/entities';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import type { InvoiceEventRepository } from '../../../domain/repositories/invoice-event.repository';
import { InvoiceEventOrmEntity } from '../entities/invoice-event.orm-entity';

type InvoiceStatusValue =
  (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

@Injectable()
export class InvoiceEventTypeOrmRepository implements InvoiceEventRepository {
  constructor(
    @InjectRepository(InvoiceEventOrmEntity)
    private readonly repo: Repository<InvoiceEventOrmEntity>,
  ) {}

  /**
   * Returns a new instance scoped to the provided EntityManager.
   * Used by TypeOrmUnitOfWork to share a single database transaction.
   */
  forManager(em: EntityManager): InvoiceEventTypeOrmRepository {
    return new InvoiceEventTypeOrmRepository(
      em.getRepository(InvoiceEventOrmEntity),
    );
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceEvent[]> {
    const orms = await this.repo.find({
      where: { invoiceId },
      order: { timestamp: 'ASC' },
    });
    return orms.map((orm) =>
      InvoiceEvent.reconstruct({
        id: orm.id,
        invoiceId: orm.invoiceId,
        from: orm.fromStatus as InvoiceStatusValue,
        to: orm.toStatus as InvoiceStatusValue,
        userId: orm.userId,
        timestamp: orm.timestamp,
      }),
    );
  }

  async save(event: InvoiceEvent): Promise<void> {
    const orm = new InvoiceEventOrmEntity();
    orm.id = event.getId();
    orm.invoiceId = event.getInvoiceId();
    orm.fromStatus = event.getFrom();
    orm.toStatus = event.getTo();
    orm.userId = event.getUserId();
    orm.timestamp = event.getTimestamp();
    await this.repo.save(orm);
  }
}
