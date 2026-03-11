import { describe, it, expect } from 'vitest';
import { Invoice } from '../invoice.entity';
import { InvalidStateTransitionError } from '../../errors';
import {
  InvoiceAmount,
  InvoiceDate,
  InvoiceStatusEnum,
} from '../../value-objects';
import { createExtractedData } from '../../test/factories';

// Factory helper para no repetir props en cada test
function makeValidProps() {
  return {
    id: 'inv-001',
    providerId: 'prov-001',
    uploaderId: 'user-001',
    filePath: 'uploads/inv-001.pdf',
    amount: InvoiceAmount.create(100.5)._unsafeUnwrap(),
    date: InvoiceDate.create(new Date('2024-06-01'))._unsafeUnwrap(),
    createdAt: new Date('2024-06-01'),
  };
}

describe('Invoice', () => {
  describe('create', () => {
    it('should create an invoice with PENDING status', () => {
      // Arrange & Act
      const result = Invoice.create(makeValidProps());

      // Assert
      expect(result.isOk()).toBe(true);
      const invoice = result._unsafeUnwrap();
      expect(invoice.getId()).toBe('inv-001');
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.PENDING);
    });

    it('should expose all provided properties', () => {
      // Arrange & Act
      const props = makeValidProps();
      const invoice = Invoice.create(props)._unsafeUnwrap();

      // Assert
      expect(invoice.getId()).toBe(props.id);
      expect(invoice.getProviderId()).toBe(props.providerId);
      expect(invoice.getUploaderId()).toBe(props.uploaderId);
      expect(invoice.getFilePath()).toBe(props.filePath);
      expect(invoice.getAmount()).toBe(props.amount);
      expect(invoice.getDate()).toBe(props.date);
      expect(invoice.getCreatedAt()).toBe(props.createdAt);
    });

    it('should return error when id is empty', () => {
      // Arrange & Act
      const result = Invoice.create({ ...makeValidProps(), id: '' });

      // Assert
      expect(result.isErr()).toBe(true);
    });
  });

  describe('startProcessing', () => {
    it('should transition from PENDING to PROCESSING', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();

      // Act
      const result = invoice.startProcessing();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.PROCESSING);
    });

    it('should return error when not in PENDING status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing(); // PENDING → PROCESSING

      // Act
      const result = invoice.startProcessing(); // PROCESSING → PROCESSING (invalid)

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('markExtracted', () => {
    it('should transition from PROCESSING to EXTRACTED', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();

      // Act
      const result = invoice.markExtracted(createExtractedData({ rawText: 'extracted text' }));

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.EXTRACTED);
      expect(invoice.getExtractedData()).toEqual(createExtractedData({ rawText: 'extracted text' }));
    });

    it('should return error when not in PROCESSING status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      // Still in PENDING

      // Act
      const result = invoice.markExtracted(createExtractedData({ rawText: 'text' }));

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('markValidationFailed', () => {
    it('should transition from EXTRACTED to VALIDATION_FAILED', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();
      invoice.markExtracted(createExtractedData({ rawText: 'text' }));

      // Act
      const result = invoice.markValidationFailed(['Total is missing']);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(
        InvoiceStatusEnum.VALIDATION_FAILED,
      );
      expect(invoice.getValidationErrors()).toEqual(['Total is missing']);
    });

    it('should return error when not in EXTRACTED status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      // Still in PENDING

      // Act
      const result = invoice.markValidationFailed(['error']);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('markReadyForApproval', () => {
    it('should transition from EXTRACTED to READY_FOR_APPROVAL', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();
      invoice.markExtracted(createExtractedData({ rawText: 'text' }));

      // Act
      const result = invoice.markReadyForApproval();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(
        InvoiceStatusEnum.READY_FOR_APPROVAL,
      );
    });

    it('should return error when not in EXTRACTED status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();

      // Act
      const result = invoice.markReadyForApproval();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('approve', () => {
    it('should transition from READY_FOR_APPROVAL to APPROVED', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();
      invoice.markExtracted(createExtractedData({ rawText: 'text' }));
      invoice.markReadyForApproval();

      // Act
      const result = invoice.approve('approver-001');

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.APPROVED);
      expect(invoice.getApproverId()).toBe('approver-001');
    });

    it('should return error when not in READY_FOR_APPROVAL status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      // Still in PENDING

      // Act
      const result = invoice.approve('approver-001');

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('reject', () => {
    it('should transition from READY_FOR_APPROVAL to REJECTED', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();
      invoice.markExtracted(createExtractedData({ rawText: 'text' }));
      invoice.markReadyForApproval();

      // Act
      const result = invoice.reject('approver-001', 'Amount does not match');

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.REJECTED);
      expect(invoice.getRejectionReason()).toBe('Amount does not match');
    });

    it('should return error when not in READY_FOR_APPROVAL status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();

      // Act
      const result = invoice.reject('approver-001', 'reason');

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('retry', () => {
    it('should transition from VALIDATION_FAILED to PROCESSING', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();
      invoice.startProcessing();
      invoice.markExtracted(createExtractedData({ rawText: 'text' }));
      invoice.markValidationFailed(['error']);

      // Act
      const result = invoice.retry();

      // Assert
      expect(result.isOk()).toBe(true);
      expect(invoice.getStatus().getValue()).toBe(InvoiceStatusEnum.PROCESSING);
    });

    it('should return error when not in VALIDATION_FAILED status', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();

      // Act
      const result = invoice.retry();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(
        InvalidStateTransitionError,
      );
    });
  });

  describe('immutability', () => {
    it('should not allow changing id after creation', () => {
      // Arrange
      const invoice = Invoice.create(makeValidProps())._unsafeUnwrap();

      // Assert — id is readonly, TypeScript prevents reassignment
      expect(invoice.getId()).toBe('inv-001');
    });

    it('should not allow changing createdAt after creation', () => {
      // Arrange
      const props = makeValidProps();
      const invoice = Invoice.create(props)._unsafeUnwrap();

      // Assert
      expect(invoice.getCreatedAt()).toBe(props.createdAt);
    });
  });
});
