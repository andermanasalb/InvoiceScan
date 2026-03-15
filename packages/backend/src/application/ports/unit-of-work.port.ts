import type { InvoiceRepository } from '../../domain/repositories/invoice.repository';
import type { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import type { OutboxEventRepository } from '../../domain/repositories/outbox-event.repository';

/**
 * UoWContext
 *
 * Scoped repository instances that share the same database transaction.
 * Passed as the argument to the callback in UnitOfWorkPort.execute().
 */
export interface UoWContext {
  invoiceRepo: InvoiceRepository;
  invoiceEventRepo: InvoiceEventRepository;
  outboxRepo: OutboxEventRepository;
}

/**
 * UnitOfWorkPort
 *
 * Abstraction for running multiple repository saves inside a single
 * atomic database transaction (T1 — fully atomic).
 *
 * Usage:
 *   await this.uow.execute(async ({ invoiceRepo, invoiceEventRepo, outboxRepo }) => {
 *     await invoiceRepo.save(invoice);
 *     await invoiceEventRepo.save(event);
 *     await outboxRepo.save(domainEvent);
 *   });
 *
 * If any operation inside the callback throws, the entire transaction is
 * rolled back — guaranteeing all-or-nothing persistence.
 */
export interface UnitOfWorkPort {
  execute<T>(fn: (ctx: UoWContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK_TOKEN = 'UNIT_OF_WORK_TOKEN';
