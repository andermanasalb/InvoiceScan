import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from 'neverthrow';
import { ProcessInvoiceUseCase } from '../process-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { StoragePort, AuditPort, OcrPort } from '../../ports';
import { createInvoice } from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import { OcrError } from '../../../domain/errors/ocr.errors';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const FAKE_PDF = Buffer.from('%PDF-1.4 fake pdf content');
const FAKE_TEXT = 'FACTURA 001\nTotal: 100,00 EUR';

describe('ProcessInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockStorage: StoragePort;
  let mockOcr: OcrPort;
  let mockAudit: AuditPort;
  let useCase: ProcessInvoiceUseCase;

  beforeEach(() => {
    const pendingInvoice = createInvoice({ id: INVOICE_ID });

    mockRepo = {
      findById: vi.fn().mockResolvedValue(pendingInvoice),
      findAll: vi.fn(),
      findByUploaderId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };

    mockStorage = {
      save: vi.fn(),
      get: vi.fn().mockResolvedValue(FAKE_PDF),
      delete: vi.fn(),
      getSignedUrl: vi.fn(),
    };

    mockOcr = {
      extractText: vi.fn().mockResolvedValue(ok({ text: FAKE_TEXT, confidence: 95 })),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new ProcessInvoiceUseCase(mockRepo, mockStorage, mockOcr, mockAudit);
  });

  describe('execute', () => {
    it('should transition invoice to EXTRACTED when OCR succeeds', async () => {
      // Arrange — pendingInvoice en beforeEach

      // Act
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.EXTRACTED);
    });

    it('should store raw OCR text in extractedData', async () => {
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().extractedData?.rawText).toBe(FAKE_TEXT);
    });

    it('should transition invoice to VALIDATION_FAILED when OCR fails', async () => {
      // Arrange
      mockOcr.extractText = vi.fn().mockResolvedValue(
        err(new OcrError('Tesseract could not read the document')),
      );

      // Act
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.VALIDATION_FAILED);
    });

    it('should return InvoiceNotFoundError when invoice does not exist', async () => {
      // Arrange
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      // Act
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return InvalidStateTransitionError when invoice is not PENDING', async () => {
      // Arrange — factura ya en PROCESSING
      const processingInvoice = createInvoice({ id: INVOICE_ID });
      processingInvoice.startProcessing()._unsafeUnwrap();
      mockRepo.findById = vi.fn().mockResolvedValue(processingInvoice);

      // Act
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should load the PDF from storage using the invoice filePath', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockStorage.get).toHaveBeenCalledWith('uploads/test-invoice.pdf');
    });

    it('should persist the invoice after processing', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should record an audit event with action process', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'process', resourceId: INVOICE_ID }),
      );
    });
  });
});
