import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from 'neverthrow';
import { ProcessInvoiceWorker, PROCESS_INVOICE_USE_CASE_TOKEN } from '../process-invoice.worker';
import { InvoiceNotFoundError } from '../../../domain/errors';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeJob = (invoiceId: string) => ({
  data: { invoiceId },
});

describe('ProcessInvoiceWorker', () => {
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let worker: ProcessInvoiceWorker;

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue(
        ok({ invoiceId: INVOICE_ID, status: 'EXTRACTED', extractedData: { rawText: 'texto' } }),
      ),
    };

    worker = new ProcessInvoiceWorker(mockUseCase as never);
  });

  describe('process', () => {
    it('should call ProcessInvoiceUseCase with the invoiceId from the job', async () => {
      await worker.process(makeJob(INVOICE_ID) as never);

      expect(mockUseCase.execute).toHaveBeenCalledWith({ invoiceId: INVOICE_ID });
    });

    it('should complete without error when use case returns ok', async () => {
      await expect(worker.process(makeJob(INVOICE_ID) as never)).resolves.not.toThrow();
    });

    it('should throw when use case returns err so BullMQ retries the job', async () => {
      mockUseCase.execute = vi.fn().mockResolvedValue(
        err(new InvoiceNotFoundError(INVOICE_ID)),
      );

      await expect(worker.process(makeJob(INVOICE_ID) as never)).rejects.toThrow();
    });
  });
});

export { PROCESS_INVOICE_USE_CASE_TOKEN };
