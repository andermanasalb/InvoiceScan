import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { trace } from '@opentelemetry/api';
import type { OutboxEventRepository } from '../../domain/repositories/outbox-event.repository';
import { OUTBOX_EVENT_REPOSITORY } from '../../domain/repositories/outbox-event.repository';
import { outboxEventsProcessedCounter } from '../../shared/metrics/metrics';

export const OUTBOX_POLLER_QUEUE = 'outbox-poller';

/**
 * OutboxPollerWorker
 *
 * Poller simple basado en setInterval que lee la tabla outbox_events
 * cada 10 segundos y publica los eventos pendientes en el EventEmitter2
 * in-process.
 *
 * Usa setInterval en lugar de BullMQ repeatable job para evitar la
 * acumulación de schedules en Redis entre reinicios (hot-reload en dev).
 *
 * Flujo:
 *   1. outboxRepo.findUnprocessed()              → lee filas con processed = false
 *   2. eventEmitter.emitAsync(event.eventType)   → los handlers reciben el evento
 *   3. outboxRepo.markProcessed(event.id)        → marca la fila como procesada
 *
 * Idempotencia: si el worker falla antes de marcar un evento como procesado,
 * el siguiente ciclo lo reintentará (at-least-once delivery).
 */
@Injectable()
export class OutboxPollerWorker implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectPinoLogger(OutboxPollerWorker.name)
    private readonly logger: PinoLogger,
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxRepo: OutboxEventRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, 10_000);
    this.logger.info('OutboxPollerWorker: iniciado (intervalo cada 10s)');
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info('OutboxPollerWorker: detenido');
  }

  /**
   * Procesa todos los eventos pendientes en un único ciclo.
   * Protegido contra ejecuciones solapadas con un flag `running`.
   */
  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const tracer = trace.getTracer('invoice-flow-backend');
    await tracer.startActiveSpan('outbox.poll', async (span) => {
      try {
        const events = await this.outboxRepo.findUnprocessed();
        if (events.length === 0) return;

        this.logger.info(
          { count: events.length },
          'OutboxPollerWorker: procesando eventos',
        );

        for (const event of events) {
          try {
            await this.eventEmitter.emitAsync(event.eventType, event);
            await this.outboxRepo.markProcessed(event.id);
            outboxEventsProcessedCounter.add(1, { eventType: event.eventType });
            this.logger.info(
              { id: event.id, eventType: event.eventType },
              'OutboxPollerWorker: evento procesado',
            );
          } catch (err) {
            this.logger.error(
              {
                id: event.id,
                eventType: event.eventType,
                error: err instanceof Error ? err.message : String(err),
              },
              `OutboxPollerWorker: error procesando evento ${event.id}`,
            );
          }
        }
      } finally {
        this.running = false;
        span.end();
      }
    });
  }
}
