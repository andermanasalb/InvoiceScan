import { ok, err, Result } from 'neverthrow';
import {
  InvoiceAmount,
  InvoiceDate,
  InvoiceStatus,
  InvoiceStatusEnum,
} from '../value-objects';
import { InvalidStateTransitionError } from '../errors';
import { DomainError } from '../errors/domain.error';

export interface ExtractedData {
  rawText: string;
  [key: string]: unknown;
}

export interface CreateInvoiceProps {
  id: string;
  providerId: string;
  uploaderId: string;
  filePath: string;
  amount: InvoiceAmount;
  date: InvoiceDate;
  createdAt: Date;
}

export class Invoice {
  private status: InvoiceStatus;
  private extractedData: ExtractedData | null = null;
  private validationErrors: string[] = [];
  private approverId: string | null = null;
  private rejectionReason: string | null = null;

  private constructor(
    private readonly id: string,
    private readonly providerId: string,
    private readonly uploaderId: string,
    private readonly filePath: string,
    private readonly amount: InvoiceAmount,
    private readonly date: InvoiceDate,
    private readonly createdAt: Date,
  ) {
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.PENDING,
    )._unsafeUnwrap();
  }

  static create(props: CreateInvoiceProps): Result<Invoice, DomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new InvalidStateTransitionError('', 'PENDING'));
    }
    return ok(
      new Invoice(
        props.id,
        props.providerId,
        props.uploaderId,
        props.filePath,
        props.amount,
        props.date,
        props.createdAt,
      ),
    );
  }

  /**
   * Reconstructs an Invoice from persisted data (e.g. from the database).
   * Skips validation — data is assumed to be already valid since it was
   * validated by create() before being saved.
   */
  static reconstruct(props: {
    id: string;
    providerId: string;
    uploaderId: string;
    filePath: string;
    amount: InvoiceAmount;
    date: InvoiceDate;
    createdAt: Date;
    status: InvoiceStatus;
    extractedData: ExtractedData | null;
    validationErrors: string[];
    approverId: string | null;
    rejectionReason: string | null;
  }): Invoice {
    const invoice = new Invoice(
      props.id,
      props.providerId,
      props.uploaderId,
      props.filePath,
      props.amount,
      props.date,
      props.createdAt,
    );
    invoice.status = props.status;
    invoice.extractedData = props.extractedData;
    invoice.validationErrors = props.validationErrors;
    invoice.approverId = props.approverId;
    invoice.rejectionReason = props.rejectionReason;
    return invoice;
  }

  // --- State machine transitions ---

  startProcessing(): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.PENDING) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.PROCESSING,
        ),
      );
    }
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.PROCESSING,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  markExtracted(
    data: ExtractedData,
  ): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.PROCESSING) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.EXTRACTED,
        ),
      );
    }
    this.extractedData = data;
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.EXTRACTED,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  markValidationFailed(
    errors: string[],
  ): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.EXTRACTED) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.VALIDATION_FAILED,
        ),
      );
    }
    this.validationErrors = errors;
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.VALIDATION_FAILED,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  markReadyForApproval(): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.EXTRACTED) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.READY_FOR_APPROVAL,
        ),
      );
    }
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.READY_FOR_APPROVAL,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  approve(approverId: string): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.READY_FOR_APPROVAL) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.APPROVED,
        ),
      );
    }
    this.approverId = approverId;
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.APPROVED,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  reject(
    approverId: string,
    reason: string,
  ): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.READY_FOR_APPROVAL) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.REJECTED,
        ),
      );
    }
    this.approverId = approverId;
    this.rejectionReason = reason;
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.REJECTED,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  retry(): Result<void, InvalidStateTransitionError> {
    if (this.status.getValue() !== InvoiceStatusEnum.VALIDATION_FAILED) {
      return err(
        new InvalidStateTransitionError(
          this.status.getValue(),
          InvoiceStatusEnum.PROCESSING,
        ),
      );
    }
    this.validationErrors = [];
    this.status = InvoiceStatus.create(
      InvoiceStatusEnum.PROCESSING,
    )._unsafeUnwrap();
    return ok(undefined);
  }

  // --- Getters ---

  getId(): string {
    return this.id;
  }
  getProviderId(): string {
    return this.providerId;
  }
  getUploaderId(): string {
    return this.uploaderId;
  }
  getFilePath(): string {
    return this.filePath;
  }
  getAmount(): InvoiceAmount {
    return this.amount;
  }
  getDate(): InvoiceDate {
    return this.date;
  }
  getCreatedAt(): Date {
    return this.createdAt;
  }
  getStatus(): InvoiceStatus {
    return this.status;
  }
  getExtractedData(): ExtractedData | null {
    return this.extractedData;
  }
  getValidationErrors(): string[] {
    return this.validationErrors;
  }
  getApproverId(): string | null {
    return this.approverId;
  }
  getRejectionReason(): string | null {
    return this.rejectionReason;
  }
}
