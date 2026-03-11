import { randomUUID } from 'crypto';
import { Invoice, CreateInvoiceProps } from '../../entities/invoice.entity';
import { InvoiceAmount, InvoiceDate } from '../../value-objects';

const defaultProps = (): CreateInvoiceProps => ({
  id: 'inv-' + randomUUID(),
  providerId: 'provider-123',
  uploaderId: 'user-456',
  filePath: 'uploads/test-invoice.pdf',
  amount: InvoiceAmount.create(100)._unsafeUnwrap(),
  date: InvoiceDate.create(new Date('2025-01-15'))._unsafeUnwrap(),
  createdAt: new Date('2025-01-15'),
});

export const createInvoice = (overrides?: Partial<CreateInvoiceProps>): Invoice => {
  const props = { ...defaultProps(), ...overrides };
  return Invoice.create(props)._unsafeUnwrap();
};
