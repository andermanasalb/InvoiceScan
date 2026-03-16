import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportInvoicesUseCase } from '../export-invoices.use-case';
import type { ExportQueuePort } from '../../ports/export-queue.port';

const REQUESTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const JOB_ID = 'job-abc-123';

describe('ExportInvoicesUseCase', () => {
  let mockExportQueue: ExportQueuePort;
  let useCase: ExportInvoicesUseCase;

  beforeEach(() => {
    mockExportQueue = {
      enqueueExport: vi.fn().mockResolvedValue(JOB_ID),
    };

    useCase = new ExportInvoicesUseCase(mockExportQueue);
  });

  describe('execute', () => {
    it('should return ok with jobId returned by the queue', async () => {
      const result = await useCase.execute({
        format: 'csv',
        requesterId: REQUESTER_ID,
        requesterRole: 'approver',
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().jobId).toBe(JOB_ID);
    });

    it('should pass all options to exportQueue.enqueueExport', async () => {
      await useCase.execute({
        format: 'json',
        requesterId: REQUESTER_ID,
        requesterRole: 'admin',
        status: 'APPROVED',
        sort: 'createdAt:desc',
      });

      expect(mockExportQueue.enqueueExport).toHaveBeenCalledWith({
        format: 'json',
        requesterId: REQUESTER_ID,
        requesterRole: 'admin',
        status: 'APPROVED',
        sort: 'createdAt:desc',
      });
    });

    it('should call enqueueExport exactly once', async () => {
      await useCase.execute({
        format: 'csv',
        requesterId: REQUESTER_ID,
        requesterRole: 'validator',
      });

      expect(mockExportQueue.enqueueExport).toHaveBeenCalledOnce();
    });
  });
});
