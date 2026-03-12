import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { OutboxEventRepository } from '../../domain/repositories/outbox-event.repository';
import { OUTBOX_EVENT_REPOSITORY } from '../../domain/repositories/outbox-event.repository';

export const OUTBOX_POLLER_QUEUE = 'outbox-poller';

/**
 * OutboxPollerWorker
 *
 * BullMQ worker que lee la tabla outbox_events cada 10 segundos y publica
 * los eventos pendientes en el EventEmitter2 in-process.
 *
 * Flujo:
 *   1. outboxRepo.findUnprocessed()             → lee filas con processed = false
 *   2. eventEmitter.emit(event.eventType, event) → los handlers reciben el evento
 *   3. outboxRepo.markProcessed(event.id)       → marca la fila como procesada
 *
 * Se registra como Repeatable Job en onModuleInit para que BullMQ lo ejecute
 * automáticamente cada 10s sin necesidad de una petición HTTP.
 *
 * Idempotencia: si el worker procesa un evento y falla antes de marcarlo como
 * procesado, el siguiente ciclo lo reintentará (at-least-once delivery).
 * El handler debe tolerar duplicados.
 */
@Processor(OUTBOX_POLLER_QUEUE)
@Injectable()
export class OutboxPollerWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutboxPollerWorker.name);

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxRepo: OutboxEventRepository,
    @InjectQueue(OUTBOX_POLLER_QUEUE)
    private readonly pollerQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  /**
   * Registra el Repeatable Job al arrancar el módulo.
   * BullMQ deduplica automáticamente por jobId, así que aunque el módulo
   * se reinicie varias veces, solo existirá una instancia del job repetible.
   */
  async onModuleInit(): Promise<void> {
    await this.pollerQueue.add(
      'poll',
      {},
      {
        repeat: { every: 10_000 }, // cada 10 segundos
        jobId: 'outbox-poller-repeatable',
      },
    );
    this.logger.log('OutboxPollerWorker: repeatable job registrado (cada 10s)');
  }

  /**
   * BullMQ llama a este método cada vez que ejecuta el job repetible.
   * Procesa todos los eventos pendientes en un único ciclo.
   */
  async process(_job: Job): Promise<void> {
    const events = await this.outboxRepo.findUnprocessed();

    if (events.length === 0) return;

    this.logger.log(`OutboxPollerWorker: procesando ${events.length} evento(s)`);

    for (const event of events) {
      try {
        await this.eventEmitter.emitAsync(event.eventType, event);
        await this.outboxRepo.markProcessed(event.id);
        this.logger.log(`OutboxPollerWorker: evento procesado`, {
          id: event.id,
          eventType: event.eventType,
        });
      } catch (err) {
        // Si un evento falla, logueamos y continuamos con los demás.
        // El evento fallido queda con processed = false y se reintentará
        // en el siguiente ciclo de 10s.
        this.logger.error(`OutboxPollerWorker: error procesando evento ${event.id}`, {
          eventType: event.eventType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
