/**
 * @file GetInvoiceStatsUseCase
 *
 * Returns a map of InvoiceStatus → count for the current user.
 *
 * - `uploader` → counts only invoices uploaded by the requester
 * - `validator` → counts invoices from assigned uploaders + own
 * - `approver`  → counts invoices from assigned validators' uploaders + own
 * - `admin`     → counts everything
 */
import { ok, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import type {
  GetInvoiceStatsInput,
  GetInvoiceStatsOutput,
} from '../dtos/get-invoice-stats.dto';
import { DomainError } from '../../domain/errors/domain.error';
import { UserRole } from '../../domain/entities/user.entity';

export class GetInvoiceStatsUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly assignmentRepo: AssignmentRepository,
  ) {}

  async execute(
    input: GetInvoiceStatsInput,
  ): Promise<Result<GetInvoiceStatsOutput, DomainError>> {
    if (input.requesterRole === UserRole.UPLOADER) {
      const counts = await this.invoiceRepo.countByStatusForUploader(
        input.requesterId,
      );
      return ok(counts);
    }

    if (input.requesterRole === UserRole.VALIDATOR) {
      const assignedUploaderIds =
        await this.assignmentRepo.getAssignedUploaderIds(input.requesterId);
      const allIds = Array.from(
        new Set([input.requesterId, ...assignedUploaderIds]),
      );
      const counts = await this.invoiceRepo.countByStatusForUploaderIds(allIds);
      return ok(counts);
    }

    if (input.requesterRole === UserRole.APPROVER) {
      const validatorIds = await this.assignmentRepo.getAssignedValidatorIds(
        input.requesterId,
      );
      const uploaderIdArrays = await Promise.all(
        validatorIds.map((vId) =>
          this.assignmentRepo.getAssignedUploaderIds(vId),
        ),
      );
      const uploaderIds = uploaderIdArrays.flat();
      const allIds = Array.from(
        new Set([input.requesterId, ...validatorIds, ...uploaderIds]),
      );
      const counts = await this.invoiceRepo.countByStatusForUploaderIds(allIds);
      return ok(counts);
    }

    // Admin: global count
    const counts = await this.invoiceRepo.countByStatus();
    return ok(counts);
  }
}
