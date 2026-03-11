import { Inject, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PROCESS_INVOICE_QUEUE } from '../../infrastructure/queue/invoice-queue.service';
import { ProcessInvoiceUseCase } from '../../application/use-cases/process-invoice.use-case';

export const PROCESS_INVOICE_USE_CASE_TOKEN = 'ProcessInvoiceUseCase';

export interface ProcessInvoiceJobData {
  invoiceId: string;
}

@Processor(PROCESS_INVOICE_QUEUE)
@Injectable()
export class ProcessInvoiceWorker extends WorkerHost {
  constructor(
    @Inject(PROCESS_INVOICE_USE_CASE_TOKEN)
    private readonly useCase: ProcessInvoiceUseCase,
  ) {
    super();
  }

  async process(job: Job<ProcessInvoiceJobData>): Promise<void> {
    const { invoiceId } = job.data;

    const result = await this.useCase.execute({ invoiceId });

    /**
     * Si el use case devuelve err, lanzamos un Error para que BullMQ
     * marque el job como fallido y active el mecanismo de reintentos.
     */
    if (result.isErr()) {
      throw new Error(result.error.message);
    }
  }
}
