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
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly findUploaderEmail: (
      uploaderId: string,
    ) => Promise<string | null>,
  ) {}

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

    const raw = invoice.getExtractedData();
    const extractedData = raw
      ? {
          total: raw.total ?? null,
          fecha: raw.fecha ?? null,
          numeroFactura: raw.numeroFactura ?? null,
          nombreEmisor: raw.nombreEmisor ?? null,
          nifEmisor: raw.nifEmisor ?? null,
          baseImponible: raw.baseImponible ?? null,
          iva: raw.iva ?? null,
        }
      : null;

    const uploaderEmail = await this.findUploaderEmail(invoice.getUploaderId());

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      uploaderId: invoice.getUploaderId(),
      uploaderEmail,
      providerId: invoice.getProviderId(),
      filePath: invoice.getFilePath(),
      amount: invoice.getAmount().getValue(),
      date: invoice.getDate().getValue(),
      createdAt: invoice.getCreatedAt(),
      validatorId: invoice.getValidatorId(),
      approverId: invoice.getApproverId(),
      rejectionReason: invoice.getRejectionReason(),
      validationErrors: invoice.getValidationErrors(),
      extractedData,
    });
  }
}
