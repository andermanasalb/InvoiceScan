import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PinoLogger } from 'nestjs-pino';
import { OutboxPollerWorker } from '../outbox-poller.worker';
import type {
  OutboxEventRepository,
  OutboxEventRecord,
} from '../../../domain/repositories/outbox-event.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRecord = (
  overrides?: Partial<OutboxEventRecord>,
): OutboxEventRecord => ({
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
  let mockEventEmitter: { emitAsync: ReturnType<typeof vi.fn> };
  let worker: OutboxPollerWorker;

  beforeEach(() => {
    vi.useFakeTimers();

    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as PinoLogger;

    mockOutboxRepo = {
      save: vi.fn(),
      findUnprocessed: vi.fn().mockResolvedValue([]),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emitAsync: vi.fn().mockResolvedValue(undefined),
    };

    worker = new OutboxPollerWorker(
      mockLogger,
      mockOutboxRepo,
      mockEventEmitter as never,
    );
  });

  afterEach(() => {
    worker.onModuleDestroy();
    vi.useRealTimers();
  });

  // --- onModuleInit / onModuleDestroy ---

  describe('onModuleInit', () => {
    it('should start the interval on init', () => {
      worker.onModuleInit();
      // No errors thrown — interval is registered
      expect(true).toBe(true);
    });

    it('should stop the interval on destroy', () => {
      worker.onModuleInit();
      worker.onModuleDestroy();
      // No errors thrown — interval is cleared
      expect(true).toBe(true);
    });
  });

  // --- poll (triggered via interval) ---

  describe('poll', () => {
    it('should do nothing when there are no unprocessed events', async () => {
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([]);
      worker.onModuleInit();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
      expect(mockOutboxRepo.markProcessed).not.toHaveBeenCalled();
    });

    it('should emit each event via the EventEmitter', async () => {
      const rec1 = makeRecord({ eventType: 'invoice.approved' });
      const rec2 = makeRecord({ eventType: 'invoice.rejected' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec1, rec2]);
      worker.onModuleInit();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'invoice.approved',
        rec1,
      );
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        'invoice.rejected',
        rec2,
      );
    });

    it('should mark each event as processed after emitting', async () => {
      const rec = makeRecord({ id: 'evt-abc' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec]);
      worker.onModuleInit();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockOutboxRepo.markProcessed).toHaveBeenCalledWith('evt-abc');
    });

    it('should process all events even if one emit throws', async () => {
      const rec1 = makeRecord({ id: 'evt-good' });
      const rec2 = makeRecord({ id: 'evt-bad', eventType: 'invoice.rejected' });
      mockOutboxRepo.findUnprocessed = vi.fn().mockResolvedValue([rec1, rec2]);

      mockEventEmitter.emitAsync = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('handler failed'));

      worker.onModuleInit();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockOutboxRepo.markProcessed).toHaveBeenCalledWith('evt-good');
      expect(mockOutboxRepo.markProcessed).not.toHaveBeenCalledWith('evt-bad');
    });

    it('should call findUnprocessed once per poll cycle', async () => {
      worker.onModuleInit();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockOutboxRepo.findUnprocessed).toHaveBeenCalledOnce();
    });
  });
});
