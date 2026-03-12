import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxPollerWorker } from '../outbox-poller.worker';
import type { OutboxEventRepository, OutboxEventRecord } from '../../../domain/repositories/outbox-event.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRecord = (overrides?: Partial<OutboxEventRecord>): OutboxEventRecord => ({
  id: 'evt-' + Math.random().toString(36).slice(2),
  eventType: 'invoice.approved',
  payload: { invoiceId: 'inv-1', approverId: 'usr-1', status: 'APPROVED' },
  processed: false,
  createdAt: new Date(),
  processedAt: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutboxPollerWorker', () => {
  let mockOutboxRepo: OutboxEventRepository;
  let mockPollerQueue: { add: ReturnType<typeof vi.fn> };
  let mockEventEmitter: { emitAsync: ReturnType<typeof vi.fn> };
  let worker: OutboxPollerWorker;

  beforeEach(() => {
    mockOutboxRepo = {
      save: vi.fn(),
      findUnprocessed: vi.fn().mockResolvedValue([]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };

    mockPollerQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emitAsync: vi.fn().mockResolvedValue(undefined),
    };

    worker = new OutboxPollerWorker(
      mockOutboxRepo,
      mockPollerQueue as never,
      mockEventEmitter as never,
    );
  });

  // --- onModuleInit ---

  describe('onModuleInit', () => {
    it('should register a repeatable job on the poller queue', async () => {
      await worker.onModuleInit();

      expect(mockPollerQueue.add).toHaveBeenCalledWith(
        'poll',
        {},
        expect.objectContaining({
          repeat: { every: 10_000 },
          jobId: 'outbox-poller-repeatable',
        }),
      );
    });
  });

  // --- process ---

  describe('process', () => {
    it('should do nothing when there are no unprocessed events', async () => {
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([]);

      await worker.process({} as never);

      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
      expect(mockOutboxRepo.markProcessed).not.toHaveBeenCalled();
    });

    it('should emit each event via the EventEmitter', async () => {
      const rec1 = makeRecord({ eventType: 'invoice.approved' });
      const rec2 = makeRecord({ eventType: 'invoice.rejected' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec1, rec2]);

      await worker.process({} as never);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith('invoice.approved', rec1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith('invoice.rejected', rec2);
    });

    it('should mark each event as processed after emitting', async () => {
      const rec = makeRecord({ id: 'evt-abc' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec]);

      await worker.process({} as never);

      expect(mockOutboxRepo.markProcessed).toHaveBeenCalledWith('evt-abc');
    });

    it('should process all events even if one emit throws', async () => {
      const rec1 = makeRecord({ id: 'evt-good' });
      const rec2 = makeRecord({ id: 'evt-bad', eventType: 'invoice.rejected' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec1, rec2]);

      // El segundo evento falla al emitir
      mockEventEmitter.emitAsync = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('handler failed'));

      await worker.process({} as never);

      // El primero se marcó como procesado
      expect(mockOutboxRepo.markProcessed).toHaveBeenCalledWith('evt-good');
      // El segundo NO se marcó (el error ocurrió antes del markProcessed)
      expect(mockOutboxRepo.markProcessed).not.toHaveBeenCalledWith('evt-bad');
    });

    it('should call findUnprocessed once per process call', async () => {
      await worker.process({} as never);

      expect(mockOutboxRepo.findUnprocessed).toHaveBeenCalledOnce();
    });
  });
});
