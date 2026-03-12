import { ok, err, Result } from 'neverthrow';
import type { InvoiceRepository } from '../../domain/repositories';
import type { InvoiceEventRepository } from '../../domain/repositories/invoice-event.repository';
import {
  GetInvoiceEventsInput,
  GetInvoiceEventsOutput,
} from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError, UnauthorizedError } from '../../domain/errors';
import { UserRole } from '../../domain/entities/user.entity';

const ROLES_WITH_FULL_ACCESS: string[] = [
  UserRole.VALIDATOR,
  UserRole.APPROVER,
  UserRole.ADMIN,
];

export class GetInvoiceEventsUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly invoiceEventRepo: InvoiceEventRepository,
  ) {}

  async execute(
    input: GetInvoiceEventsInput,
  ): Promise<Result<GetInvoiceEventsOutput, DomainError>> {
    // First verify the invoice exists (and check ownership for uploaders)
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const hasFullAccess = ROLES_WITH_FULL_ACCESS.includes(input.requesterRole);
    const isOwner = invoice.getUploaderId() === input.requesterId;

    if (!hasFullAccess && !isOwner) {
      return err(new UnauthorizedError('access invoice events'));
    }

    const events = await this.invoiceEventRepo.findByInvoiceId(input.invoiceId);

    return ok(
      events.map((event) => ({
        id: event.getId(),
        invoiceId: event.getInvoiceId(),
        from: event.getFrom(),
        to: event.getTo(),
        userId: event.getUserId(),
        timestamp: event.getTimestamp(),
      })),
    );
  }
}
