import { ok, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { ListInvoicesInput, ListInvoicesOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { UserRole } from '../../domain/entities/user.entity';
import { Invoice } from '../../domain/entities';

export class ListInvoicesUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly assignmentRepo: AssignmentRepository,
  ) {}

  async execute(
    input: ListInvoicesInput,
  ): Promise<Result<ListInvoicesOutput, DomainError>> {
    const filters = {
      status: input.status,
      page: input.page,
      limit: input.limit,
      sort: input.sort,
    };

    let result: { items: Invoice[]; total: number };

    if (input.requesterRole === UserRole.UPLOADER) {
      // Uploaders see only their own invoices
      result = await this.invoiceRepo.findByUploaderId(
        input.requesterId,
        filters,
      );
    } else if (input.requesterRole === UserRole.VALIDATOR) {
      // Validators see their own invoices + invoices from assigned uploaders
      const assignedUploaderIds =
        await this.assignmentRepo.getAssignedUploaderIds(input.requesterId);
      const allIds = Array.from(
        new Set([input.requesterId, ...assignedUploaderIds]),
      );
      result = await this.invoiceRepo.findByUploaderIds(allIds, filters);
    } else if (input.requesterRole === UserRole.APPROVER) {
      // Approvers see their own + assigned validators' invoices + those validators' uploaders
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
      result = await this.invoiceRepo.findByUploaderIds(allIds, filters);
    } else {
      // Admin sees everything
      result = await this.invoiceRepo.findAll(filters);
    }

    return ok({
      items: result.items.map((invoice: Invoice) => ({
        invoiceId: invoice.getId(),
        status: invoice.getStatus().getValue(),
        uploaderId: invoice.getUploaderId(),
        validatorId: invoice.getValidatorId(),
        providerId: invoice.getProviderId(),
        vendorName: invoice.getExtractedData()?.nombreEmisor ?? null,
        // Prefer the LLM-extracted total; fall back to the upload-time placeholder.
        amount:
          invoice.getExtractedData()?.total ?? invoice.getAmount().getValue(),
        date: invoice.getDate().getValue(),
        createdAt: invoice.getCreatedAt(),
      })),
      total: result.total,
      page: input.page,
      limit: input.limit,
    });
  }
}
