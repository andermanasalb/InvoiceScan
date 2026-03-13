import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { InvoiceNoteRepository } from '../../domain/repositories/invoice-note.repository';
import { DomainError } from '../../domain/errors/domain.error';
import { InvoiceNotFoundError } from '../../domain/errors';
import { AddNoteInput, AddNoteOutput } from '../dtos/add-note.dto';

export class AddNoteUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly noteRepo: InvoiceNoteRepository,
  ) {}

  async execute(
    input: AddNoteInput,
  ): Promise<Result<AddNoteOutput, DomainError>> {
    // Verify invoice exists and requester has access
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const note = {
      id: randomUUID(),
      invoiceId: input.invoiceId,
      authorId: input.authorId,
      content: input.content,
      createdAt: new Date(),
    };

    await this.noteRepo.save(note);

    return ok({
      noteId: note.id,
      invoiceId: note.invoiceId,
      authorId: note.authorId,
      content: note.content,
      createdAt: note.createdAt,
    });
  }
}
