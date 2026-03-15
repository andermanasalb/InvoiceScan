import { ok, Result } from 'neverthrow';
import type { ExportQueuePort } from '../ports/export-queue.port';
import type {
  ExportInvoicesInput,
  ExportInvoicesOutput,
} from '../dtos/export-invoices.dto';
import type { DomainError } from '../../domain/errors/domain.error';

/**
 * ExportInvoicesUseCase
 *
 * Encola un job de exportación y devuelve el jobId inmediatamente.
 * El worker ExportInvoicesWorker procesa el job de forma asíncrona,
 * genera el fichero CSV o JSON y lo guarda en disco.
 * El cliente hace polling a GET /api/v1/exports/:jobId/status.
 */
export class ExportInvoicesUseCase {
  constructor(private readonly exportQueue: ExportQueuePort) {}

  async execute(
    input: ExportInvoicesInput,
  ): Promise<Result<ExportInvoicesOutput, DomainError>> {
    const jobId = await this.exportQueue.enqueueExport({
      format: input.format,
      requesterId: input.requesterId,
      requesterRole: input.requesterRole,
      status: input.status,
      sort: input.sort,
    });

    return ok({ jobId });
  }
}
