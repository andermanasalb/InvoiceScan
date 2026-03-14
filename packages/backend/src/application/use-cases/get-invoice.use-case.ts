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
    /** Looks up any user's email by their ID — used for uploader, validator and approver. */
    private readonly findUserEmail: (userId: string) => Promise<string | null>,
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
          ivaPorcentaje: raw.ivaPorcentaje ?? null,
        }
      : null;

    const validatorId = invoice.getValidatorId();
    const approverId = invoice.getApproverId();

    const [uploaderEmail, validatorEmail, approverEmail] = await Promise.all([
      this.findUserEmail(invoice.getUploaderId()),
      validatorId ? this.findUserEmail(validatorId) : Promise.resolve(null),
      approverId ? this.findUserEmail(approverId) : Promise.resolve(null),
    ]);

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      uploaderId: invoice.getUploaderId(),
      uploaderEmail,
      providerId: invoice.getProviderId(),
      filePath: invoice.getFilePath(),
      // Prefer LLM-extracted total; fall back to upload-time placeholder.
      amount: raw?.total ?? invoice.getAmount().getValue(),
      date: invoice.getDate().getValue(),
      createdAt: invoice.getCreatedAt(),
      validatorId,
      validatorEmail,
      approverId,
      approverEmail,
      rejectionReason: invoice.getRejectionReason(),
      validationErrors: invoice.getValidationErrors(),
      extractedData,
    });
  }
}
