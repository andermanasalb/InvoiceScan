import { ok, err, Result } from 'neverthrow';
import { DomainError } from '../errors/domain.error';
import { InvalidStateTransitionError } from '../errors';
import { InvoiceStatusEnum } from '../value-objects';

type InvoiceStatusValue =
  (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

export interface CreateInvoiceEventProps {
  id: string;
  invoiceId: string;
  from: InvoiceStatusValue;
  to: InvoiceStatusValue;
  userId: string;
  timestamp: Date;
}

export class InvoiceEvent {
  private constructor(
    private readonly id: string,
    private readonly invoiceId: string,
    private readonly from: InvoiceStatusValue,
    private readonly to: InvoiceStatusValue,
    private readonly userId: string,
    private readonly timestamp: Date,
  ) {}

  static create(
    props: CreateInvoiceEventProps,
  ): Result<InvoiceEvent, DomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new InvalidStateTransitionError('', props.to));
    }
    if (!props.invoiceId || props.invoiceId.trim().length === 0) {
      return err(new InvalidStateTransitionError('', props.to));
    }
    if (props.from === props.to) {
      return err(new InvalidStateTransitionError(props.from, props.to));
    }
    return ok(
      new InvoiceEvent(
        props.id,
        props.invoiceId,
        props.from,
        props.to,
        props.userId,
        props.timestamp,
      ),
    );
  }

  getId(): string {
    return this.id;
  }
  getInvoiceId(): string {
    return this.invoiceId;
  }
  getFrom(): InvoiceStatusValue {
    return this.from;
  }
  getTo(): InvoiceStatusValue {
    return this.to;
  }
  getUserId(): string {
    return this.userId;
  }
  getTimestamp(): Date {
    return this.timestamp;
  }
}
