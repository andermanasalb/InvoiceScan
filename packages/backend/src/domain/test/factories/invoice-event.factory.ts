import { randomUUID } from 'crypto';
import {
  InvoiceEvent,
  CreateInvoiceEventProps,
} from '../../entities/invoice-event.entity';
import { InvoiceStatusEnum } from '../../value-objects';

const defaultProps = (): CreateInvoiceEventProps => ({
  id: randomUUID(),
  invoiceId: randomUUID(),
  from: InvoiceStatusEnum.PENDING,
  to: InvoiceStatusEnum.PROCESSING,
  userId: randomUUID(),
  timestamp: new Date('2025-01-15'),
});

export const createInvoiceEvent = (
  overrides?: Partial<CreateInvoiceEventProps>,
): InvoiceEvent => {
  const props = { ...defaultProps(), ...overrides };
  return InvoiceEvent.create(props)._unsafeUnwrap();
};
