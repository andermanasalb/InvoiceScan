import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';

import { STORAGE_TOKEN } from './infrastructure/storage/local-storage.adapter';
import { InvoiceQueueService } from './infrastructure/queue/invoice-queue.service';
import { OutboxEventBusAdapter } from './infrastructure/events/outbox-event-bus.adapter';
import { EVENT_BUS_TOKEN } from './application/ports/event-bus.port';
import { OUTBOX_EVENT_REPOSITORY } from './domain/repositories/outbox-event.repository';
import { INVOICE_EVENT_REPOSITORY } from './domain/repositories/invoice-event.repository';
import { AuditEventTypeOrmRepository } from './infrastructure/db/repositories/audit-event.typeorm-repository';

import { UploadInvoiceUseCase } from './application/use-cases/upload-invoice.use-case';
import { ListInvoicesUseCase } from './application/use-cases/list-invoices.use-case';
import { GetInvoiceUseCase } from './application/use-cases/get-invoice.use-case';
import { ApproveInvoiceUseCase } from './application/use-cases/approve-invoice.use-case';
import { RejectInvoiceUseCase } from './application/use-cases/reject-invoice.use-case';
import { GetInvoiceEventsUseCase } from './application/use-cases/get-invoice-events.use-case';

import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
  LIST_INVOICES_USE_CASE_TOKEN,
  GET_INVOICE_USE_CASE_TOKEN,
  APPROVE_INVOICE_USE_CASE_TOKEN,
  REJECT_INVOICE_USE_CASE_TOKEN,
  GET_INVOICE_EVENTS_USE_CASE_TOKEN,
} from './interface/http/controllers/invoices.controller';

import type { InvoiceRepository } from './domain/repositories';
import type { InvoiceEventRepository } from './domain/repositories/invoice-event.repository';
import type { OutboxEventRepository } from './domain/repositories/outbox-event.repository';
import type { StoragePort } from './application/ports/storage.port';
import type { AuditPort } from './application/ports/audit.port';
import type { EventBusPort } from './application/ports/event-bus.port';
import type { InvoiceQueuePort } from './infrastructure/queue/invoice-queue.service';

/**
 * InvoicesModule
 *
 * Wires together everything needed to handle invoice HTTP requests.
 *
 * Dependency graph:
 *
 *   InvoicesController
 *     ├── UploadInvoiceUseCase    → InvoiceRepository, StoragePort, AuditPort, InvoiceQueuePort
 *     ├── ListInvoicesUseCase     → InvoiceRepository
 *     ├── GetInvoiceUseCase       → InvoiceRepository
 *     ├── ApproveInvoiceUseCase   → InvoiceRepository, AuditPort, EventBusPort
 *     ├── RejectInvoiceUseCase    → InvoiceRepository, AuditPort, EventBusPort
 *     └── GetInvoiceEventsUseCase → InvoiceRepository, InvoiceEventRepository
 *
 * AuditPort    → AuditEventTypeOrmRepository (real TypeORM impl, FASE 9)
 * EventBusPort → OutboxEventBusAdapter (saves to outbox_events, FASE 9)
 *
 * The OutboxPollerWorker (in JobsModule) drains outbox_events every 10s
 * and emits events in-process via EventEmitter2.
 */
@Module({
  imports: [DatabaseModule, StorageModule, QueueModule],
  controllers: [InvoicesController],
  providers: [
    // ──────────────────────────────────────────────────────────────
    // Infrastructure adapters
    // ──────────────────────────────────────────────────────────────

    // Real TypeORM audit repository (replaces NoOpAuditAdapter from FASE 4)
    AuditEventTypeOrmRepository,

    // EventBus → persists domain events to outbox_events table
    {
      provide: EVENT_BUS_TOKEN,
      useFactory: (outboxRepo: OutboxEventRepository): EventBusPort =>
        new OutboxEventBusAdapter(outboxRepo),
      inject: [OUTBOX_EVENT_REPOSITORY],
    },

    // ──────────────────────────────────────────────────────────────
    // Use cases
    // ──────────────────────────────────────────────────────────────

    {
      provide: UPLOAD_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        storage: StoragePort,
        auditor: AuditPort,
        queue: InvoiceQueuePort,
      ) => new UploadInvoiceUseCase(invoiceRepo, storage, auditor, queue),
      inject: ['InvoiceRepository', STORAGE_TOKEN, AuditEventTypeOrmRepository, InvoiceQueueService],
    },

    {
      provide: LIST_INVOICES_USE_CASE_TOKEN,
      useFactory: (invoiceRepo: InvoiceRepository) =>
        new ListInvoicesUseCase(invoiceRepo),
      inject: ['InvoiceRepository'],
    },

    {
      provide: GET_INVOICE_USE_CASE_TOKEN,
      useFactory: (invoiceRepo: InvoiceRepository) =>
        new GetInvoiceUseCase(invoiceRepo),
      inject: ['InvoiceRepository'],
    },

    {
      provide: APPROVE_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        eventBus: EventBusPort,
      ) => new ApproveInvoiceUseCase(invoiceRepo, auditor, eventBus),
      inject: ['InvoiceRepository', AuditEventTypeOrmRepository, EVENT_BUS_TOKEN],
    },

    {
      provide: REJECT_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        eventBus: EventBusPort,
      ) => new RejectInvoiceUseCase(invoiceRepo, auditor, eventBus),
      inject: ['InvoiceRepository', AuditEventTypeOrmRepository, EVENT_BUS_TOKEN],
    },

    {
      provide: GET_INVOICE_EVENTS_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        invoiceEventRepo: InvoiceEventRepository,
      ) => new GetInvoiceEventsUseCase(invoiceRepo, invoiceEventRepo),
      inject: ['InvoiceRepository', INVOICE_EVENT_REPOSITORY],
    },
  ],
})
export class InvoicesModule {}
