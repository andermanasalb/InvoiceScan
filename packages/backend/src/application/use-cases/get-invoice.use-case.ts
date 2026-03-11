import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { GetInvoiceInput, GetInvoiceOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError, UnauthorizedError } from '../../domain/errors';
import { UserRole } from '../../domain/entities/user.entity';

const ROLES_WITH_FULL_ACCESS: string[] = [
  UserRole.VALIDATOR,
  UserRole.APPROVER,
  UserRole.ADMIN,
];

export class GetInvoiceUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepository) {}

  async execute(
    input: GetInvoiceInput,
  ): Promise<Result<GetInvoiceOutput, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const hasFullAccess = ROLES_WITH_FULL_ACCESS.includes(input.requesterRole);
    const isOwner = invoice.getUploaderId() === input.requesterId;

    if (!hasFullAccess && !isOwner) {
      return err(new UnauthorizedError('access invoice'));
    }

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      uploaderId: invoice.getUploaderId(),
      providerId: invoice.getProviderId(),
      filePath: invoice.getFilePath(),
      amount: invoice.getAmount().getValue(),
      date: invoice.getDate().getValue(),
      createdAt: invoice.getCreatedAt(),
      approverId: invoice.getApproverId(),
      rejectionReason: invoice.getRejectionReason(),
      validationErrors: invoice.getValidationErrors(),
    });
  }
}
