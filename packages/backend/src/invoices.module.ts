import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';

import { STORAGE_TOKEN } from './infrastructure/storage/local-storage.adapter';
import { InvoiceQueueService } from './infrastructure/queue/invoice-queue.service';
import { OutboxEventBusAdapter } from './infrastructure/events/outbox-event-bus.adapter';
import {
  AuditAdapter,
  AUDIT_PORT_TOKEN,
} from './infrastructure/audit/audit.adapter';
import { EVENT_BUS_TOKEN } from './application/ports/event-bus.port';
import { OUTBOX_EVENT_REPOSITORY } from './domain/repositories/outbox-event.repository';
import { INVOICE_EVENT_REPOSITORY } from './domain/repositories/invoice-event.repository';
import { INVOICE_NOTE_REPOSITORY } from './domain/repositories/invoice-note.repository';
import { UploadInvoiceUseCase } from './application/use-cases/upload-invoice.use-case';
import { ListInvoicesUseCase } from './application/use-cases/list-invoices.use-case';
import { GetInvoiceUseCase } from './application/use-cases/get-invoice.use-case';
import { ApproveInvoiceUseCase } from './application/use-cases/approve-invoice.use-case';
import { RejectInvoiceUseCase } from './application/use-cases/reject-invoice.use-case';
import { GetInvoiceEventsUseCase } from './application/use-cases/get-invoice-events.use-case';
import { SendToApprovalUseCase } from './application/use-cases/send-to-approval.use-case';
import { SendToValidationUseCase } from './application/use-cases/send-to-validation.use-case';
import { RetryInvoiceUseCase } from './application/use-cases/retry-invoice.use-case';
import { AddNoteUseCase } from './application/use-cases/add-note.use-case';
import { GetInvoiceNotesUseCase } from './application/use-cases/get-invoice-notes.use-case';
import { GetInvoiceStatsUseCase } from './application/use-cases/get-invoice-stats.use-case';

import {
  InvoicesController,
  UPLOAD_INVOICE_USE_CASE_TOKEN,
  LIST_INVOICES_USE_CASE_TOKEN,
  GET_INVOICE_USE_CASE_TOKEN,
  APPROVE_INVOICE_USE_CASE_TOKEN,
  REJECT_INVOICE_USE_CASE_TOKEN,
  GET_INVOICE_EVENTS_USE_CASE_TOKEN,
  SEND_TO_APPROVAL_USE_CASE_TOKEN,
  SEND_TO_VALIDATION_USE_CASE_TOKEN,
  RETRY_INVOICE_USE_CASE_TOKEN,
  ADD_NOTE_USE_CASE_TOKEN,
  GET_INVOICE_NOTES_USE_CASE_TOKEN,
  GET_INVOICE_STATS_USE_CASE_TOKEN,
} from './interface/http/controllers/invoices.controller';

import type { InvoiceRepository } from './domain/repositories';
import type { InvoiceEventRepository } from './domain/repositories/invoice-event.repository';
import type { InvoiceNoteRepository } from './domain/repositories/invoice-note.repository';
import type { OutboxEventRepository } from './domain/repositories/outbox-event.repository';
import type { AuditEventRepository } from './domain/repositories/audit-event.repository';
import type { StoragePort } from './application/ports/storage.port';
import type { AuditPort } from './application/ports/audit.port';
import type { EventBusPort } from './application/ports/event-bus.port';
import type { InvoiceQueuePort } from './application/ports/invoice-queue.port';
import { InvoiceTypeOrmRepository } from './infrastructure/db/repositories/invoice.typeorm-repository';

/**
 * InvoicesModule
 *
 * Wires together everything needed to handle invoice HTTP requests.
 *
 * Dependency graph:
 *
 *   InvoicesController
 *     ├── UploadInvoiceUseCase      → InvoiceRepository, StoragePort, AuditPort, InvoiceQueuePort
 *     ├── ListInvoicesUseCase       → InvoiceRepository
 *     ├── GetInvoiceUseCase         → InvoiceRepository
 *     ├── ApproveInvoiceUseCase     → InvoiceRepository, AuditPort, EventBusPort
 *     ├── RejectInvoiceUseCase      → InvoiceRepository, AuditPort, EventBusPort
 *     ├── GetInvoiceEventsUseCase   → InvoiceRepository, InvoiceEventRepository
 *     ├── SendToApprovalUseCase     → InvoiceRepository, AuditPort
 *     ├── RetryInvoiceUseCase       → InvoiceRepository, AuditPort, InvoiceQueuePort
 *     ├── AddNoteUseCase            → InvoiceRepository, InvoiceNoteRepository
 *     ├── GetInvoiceNotesUseCase    → InvoiceRepository, InvoiceNoteRepository
 *     └── GetInvoiceStatsUseCase    → InvoiceRepository
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

    // EventBus → persists domain events to outbox_events table
    {
      provide: EVENT_BUS_TOKEN,
      useFactory: (outboxRepo: OutboxEventRepository): EventBusPort =>
        new OutboxEventBusAdapter(outboxRepo),
      inject: [OUTBOX_EVENT_REPOSITORY],
    },

    // AuditPort → wraps AuditEventRepository with the record() interface
    {
      provide: AUDIT_PORT_TOKEN,
      useFactory: (auditRepo: AuditEventRepository): AuditPort =>
        new AuditAdapter(auditRepo),
      inject: ['AuditEventRepository'],
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
      inject: [
        'InvoiceRepository',
        STORAGE_TOKEN,
        AUDIT_PORT_TOKEN,
        InvoiceQueueService,
      ],
    },

    {
      provide: LIST_INVOICES_USE_CASE_TOKEN,
      useFactory: (invoiceRepo: InvoiceRepository) =>
        new ListInvoicesUseCase(invoiceRepo),
      inject: ['InvoiceRepository'],
    },

    {
      provide: GET_INVOICE_USE_CASE_TOKEN,
      useFactory: (invoiceRepo: InvoiceTypeOrmRepository) =>
        new GetInvoiceUseCase(invoiceRepo, (uploaderId: string) =>
          invoiceRepo.findUploaderEmail(uploaderId),
        ),
      inject: ['InvoiceRepository'],
    },

    {
      provide: APPROVE_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        eventBus: EventBusPort,
        invoiceEventRepo: InvoiceEventRepository,
      ) =>
        new ApproveInvoiceUseCase(
          invoiceRepo,
          auditor,
          eventBus,
          invoiceEventRepo,
        ),
      inject: [
        'InvoiceRepository',
        AUDIT_PORT_TOKEN,
        EVENT_BUS_TOKEN,
        INVOICE_EVENT_REPOSITORY,
      ],
    },

    {
      provide: REJECT_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        eventBus: EventBusPort,
        invoiceEventRepo: InvoiceEventRepository,
      ) =>
        new RejectInvoiceUseCase(
          invoiceRepo,
          auditor,
          eventBus,
          invoiceEventRepo,
        ),
      inject: [
        'InvoiceRepository',
        AUDIT_PORT_TOKEN,
        EVENT_BUS_TOKEN,
        INVOICE_EVENT_REPOSITORY,
      ],
    },

    {
      provide: GET_INVOICE_EVENTS_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        invoiceEventRepo: InvoiceEventRepository,
      ) => new GetInvoiceEventsUseCase(invoiceRepo, invoiceEventRepo),
      inject: ['InvoiceRepository', INVOICE_EVENT_REPOSITORY],
    },

    {
      provide: SEND_TO_APPROVAL_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        invoiceEventRepo: InvoiceEventRepository,
      ) => new SendToApprovalUseCase(invoiceRepo, auditor, invoiceEventRepo),
      inject: ['InvoiceRepository', AUDIT_PORT_TOKEN, INVOICE_EVENT_REPOSITORY],
    },

    {
      provide: SEND_TO_VALIDATION_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        invoiceEventRepo: InvoiceEventRepository,
      ) => new SendToValidationUseCase(invoiceRepo, auditor, invoiceEventRepo),
      inject: ['InvoiceRepository', AUDIT_PORT_TOKEN, INVOICE_EVENT_REPOSITORY],
    },

    {
      provide: RETRY_INVOICE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        auditor: AuditPort,
        queue: InvoiceQueuePort,
        invoiceEventRepo: InvoiceEventRepository,
      ) =>
        new RetryInvoiceUseCase(invoiceRepo, auditor, queue, invoiceEventRepo),
      inject: [
        'InvoiceRepository',
        AUDIT_PORT_TOKEN,
        InvoiceQueueService,
        INVOICE_EVENT_REPOSITORY,
      ],
    },

    {
      provide: ADD_NOTE_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        noteRepo: InvoiceNoteRepository,
      ) => new AddNoteUseCase(invoiceRepo, noteRepo),
      inject: ['InvoiceRepository', INVOICE_NOTE_REPOSITORY],
    },

    {
      provide: GET_INVOICE_NOTES_USE_CASE_TOKEN,
      useFactory: (
        invoiceRepo: InvoiceRepository,
        noteRepo: InvoiceNoteRepository,
      ) => new GetInvoiceNotesUseCase(invoiceRepo, noteRepo),
      inject: ['InvoiceRepository', INVOICE_NOTE_REPOSITORY],
    },

    {
      provide: GET_INVOICE_STATS_USE_CASE_TOKEN,
      useFactory: (invoiceRepo: InvoiceRepository) =>
        new GetInvoiceStatsUseCase(invoiceRepo),
      inject: ['InvoiceRepository'],
    },
  ],
})
export class InvoicesModule {}
