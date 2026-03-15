import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type {
  UnitOfWorkPort,
  UoWContext,
} from '../../application/ports/unit-of-work.port';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository';
import type { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import type { OutboxEventRepository } from '../../domain/repositories/outbox-event.repository';
import { InvoiceTypeOrmRepository } from './repositories/invoice.typeorm-repository';
import { OutboxEventTypeOrmRepository } from './repositories/outbox-event.typeorm-repository';
import { InvoiceEventTypeOrmRepository } from './repositories/invoice-event.typeorm-repository';

/**
 * TypeOrmUnitOfWork
 *
 * Implements UnitOfWorkPort using TypeORM's DataSource.transaction().
 *
 * All three repository saves (invoice + invoiceEvent + outboxEvent) are
 * executed inside a single PostgreSQL transaction.  If any save throws,
 * the transaction is rolled back automatically — guaranteeing atomicity
 * (T1 — fully atomic, as per FASE 13 plan).
 *
 * The scoped repository instances are created via the forManager() factory
 * on each concrete TypeORM repository so they reuse the same EntityManager
 * (and therefore the same open transaction connection).
 */
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invoiceRepo: InvoiceTypeOrmRepository,
    private readonly invoiceEventRepo: InvoiceEventTypeOrmRepository,
    private readonly outboxRepo: OutboxEventTypeOrmRepository,
  ) {}

  async execute<T>(fn: (ctx: UoWContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const invoiceRepo: InvoiceRepository = this.invoiceRepo.forManager(em);
      const invoiceEventRepo: InvoiceEventRepository =
        this.invoiceEventRepo.forManager(em);
      const outboxRepo: OutboxEventRepository = this.outboxRepo.forManager(em);
      const ctx: UoWContext = { invoiceRepo, invoiceEventRepo, outboxRepo };
      return fn(ctx);
    });
  }
}
