import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InvoiceQueueService,
  INVOICE_QUEUE_SERVICE_TOKEN,
} from '../invoice-queue.service';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('InvoiceQueueService', () => {
  let mockQueue: { add: ReturnType<typeof vi.fn> };
  let service: InvoiceQueueService;

  beforeEach(() => {
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    service = new InvoiceQueueService(mockQueue as never);
  });

  describe('enqueueProcessing', () => {
    it('should add a job to the queue with the invoiceId as payload', async () => {
      await service.enqueueProcessing(INVOICE_ID);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        { invoiceId: INVOICE_ID },
        expect.objectContaining({ jobId: INVOICE_ID }),
      );
    });

    it('should configure 3 attempts with exponential backoff', async () => {
      await service.enqueueProcessing(INVOICE_ID);

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('should use the invoiceId as jobId for idempotency', async () => {
      await service.enqueueProcessing(INVOICE_ID);

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: INVOICE_ID }),
      );
    });
  });
});

export { INVOICE_QUEUE_SERVICE_TOKEN };
