export const INVOICE_NOTE_REPOSITORY = 'InvoiceNoteRepository';

export interface InvoiceNote {
  id: string;
  invoiceId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface InvoiceNoteRepository {
  save(note: InvoiceNote): Promise<void>;
  findByInvoiceId(invoiceId: string): Promise<InvoiceNote[]>;
}
