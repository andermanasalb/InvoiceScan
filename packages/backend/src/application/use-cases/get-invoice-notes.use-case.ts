import { ok, err, Result } from 'neverthrow';
import { InvoiceRepository } from '../../domain/repositories';
import {
  InvoiceNoteRepository,
  InvoiceNote,
} from '../../domain/repositories/invoice-note.repository';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';

export interface GetInvoiceNotesInput {
  invoiceId: string;
  requesterId: string;
  requesterRole: 'uploader' | 'validator' | 'approver' | 'admin';
}

export class GetInvoiceNotesUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly noteRepo: InvoiceNoteRepository,
  ) {}

  async execute(
    input: GetInvoiceNotesInput,
  ): Promise<Result<InvoiceNote[], DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // Uploaders can only access notes for their own invoices
    if (
      input.requesterRole === 'uploader' &&
      invoice.getUploaderId() !== input.requesterId
    ) {
      return err(new InvoiceNotFoundError(input.invoiceId));
    }

    const notes = await this.noteRepo.findByInvoiceId(input.invoiceId);
    return ok(notes);
  }
}
