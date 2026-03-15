import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceEvent } from '../../domain/entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../domain/value-objects';
import { AuditPort } from '../ports';
import { UnitOfWorkPort } from '../ports/unit-of-work.port';
import { RejectInvoiceInput, RejectInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import {
  InvoiceNotFoundError,
  SelfActionNotAllowedError,
} from '../../domain/errors';
import { InvoiceRejectedEvent } from '../../domain/events/invoice-rejected.event';
import { invoicesRejectedCounter } from '../../shared/metrics/metrics';

const tracer = trace.getTracer('invoice-flow-backend');

export class RejectInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(
    input: RejectInvoiceInput,
  ): Promise<Result<RejectInvoiceOutput, DomainError>> {
    return tracer.startActiveSpan(
      'RejectInvoiceUseCase.execute',
      async (span) => {
        span.setAttributes({
          'invoice.id': input.invoiceId,
          'invoice.approver_id': input.approverId,
          'invoice.approver_role': input.approverRole,
        });

        try {
          const invoice = await this.invoiceRepo.findById(input.invoiceId);
          if (!invoice) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'Invoice not found',
            });
            return err(new InvoiceNotFoundError(input.invoiceId));
          }

          // Ownership check: non-admins cannot act on their own invoices
          if (
            input.approverRole !== 'admin' &&
            input.approverId === invoice.getUploaderId()
          ) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'Self action not allowed',
            });
            return err(new SelfActionNotAllowedError());
          }

          const fromStatus = invoice.getStatus().getValue();
          const rejectResult = invoice.reject(input.approverId, input.reason);
          if (rejectResult.isErr()) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: rejectResult.error.message,
            });
            return err(rejectResult.error);
          }

          const domainEvent = new InvoiceRejectedEvent({
            invoiceId: invoice.getId(),
            approverId: input.approverId,
            reason: input.reason,
            status: invoice.getStatus().getValue(),
          });

          // ── Atomic transaction: invoice + invoiceEvent + outboxEvent ──
          await this.uow.execute(async (ctx) => {
            await ctx.invoiceRepo.save(invoice);

            const invoiceEvent = InvoiceEvent.create({
              id: randomUUID(),
              invoiceId: invoice.getId(),
              from: fromStatus as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
              to: invoice
                .getStatus()
                .getValue() as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
              userId: input.approverId,
              timestamp: new Date(),
            });
            if (invoiceEvent.isOk()) {
              await ctx.invoiceEventRepo.save(invoiceEvent.value);
            }

            await ctx.outboxRepo.save(domainEvent);
          });

          // ── Audit (outside transaction — audit failure must not roll back) ──
          await this.auditor.record({
            action: 'reject',
            resourceId: invoice.getId(),
            userId: input.approverId,
          });

          // ── Metrics ──
          invoicesRejectedCounter.add(1, { approverId: input.approverId });

          span.setAttributes({
            'invoice.new_status': invoice.getStatus().getValue(),
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return ok({
            invoiceId: invoice.getId(),
            status: invoice.getStatus().getValue(),
            approverId: input.approverId,
            reason: input.reason,
          });
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
