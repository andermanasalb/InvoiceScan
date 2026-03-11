import { ok, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import { ListInvoicesInput, ListInvoicesOutput } from '../dtos';
import { DomainError } from '../../domain/errors/domain.error';
import { UserRole } from '../../domain/entities/user.entity';
import { Invoice } from '../../domain/entities';

export class ListInvoicesUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepository) {}

  async execute(
    input: ListInvoicesInput,
  ): Promise<Result<ListInvoicesOutput, DomainError>> {
    const filters = {
      status: input.status,
      page: input.page,
      limit: input.limit,
      sort: input.sort,
    };

    const isUploader = input.requesterRole === UserRole.UPLOADER;

    const { items, total } = isUploader
      ? await this.invoiceRepo.findByUploaderId(input.requesterId, filters)
      : await this.invoiceRepo.findAll(filters);

    return ok({
      items: items.map((invoice: Invoice) => ({
        invoiceId: invoice.getId(),
        status: invoice.getStatus().getValue(),
        uploaderId: invoice.getUploaderId(),
        providerId: invoice.getProviderId(),
        amount: invoice.getAmount().getValue(),
        date: invoice.getDate().getValue(),
        createdAt: invoice.getCreatedAt(),
      })),
      total,
      page: input.page,
      limit: input.limit,
    });
  }
}
