/**
 * @file GetInvoiceStatsUseCase
 *
 * Returns a map of InvoiceStatus → count for the current user.
 *
 * - `uploader` role  → counts only invoices owned by the requester.
 * - All other roles  → counts across all invoices in the system.
 *
 * Uses a single GROUP BY query (via the InvoiceRepository) instead of
 * issuing one SELECT COUNT per status, avoiding the N+1 pattern that was
 * present on the dashboard page.
 */
import { ok, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import type {
  GetInvoiceStatsInput,
  GetInvoiceStatsOutput,
} from '../dtos/get-invoice-stats.dto';
import { DomainError } from '../../domain/errors/domain.error';
import { UserRole } from '../../domain/entities/user.entity';

export class GetInvoiceStatsUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepository) {}

  async execute(
    input: GetInvoiceStatsInput,
  ): Promise<Result<GetInvoiceStatsOutput, DomainError>> {
    const isUploader = input.requesterRole === UserRole.UPLOADER;

    const counts = isUploader
      ? await this.invoiceRepo.countByStatusForUploader(input.requesterId)
      : await this.invoiceRepo.countByStatus();

    return ok(counts);
  }
}
