import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from 'neverthrow';
import { ProcessInvoiceUseCase } from '../process-invoice.use-case';
import { InvoiceRepository } from '../../../domain/repositories';
import { StoragePort, AuditPort, OcrPort, LLMPort } from '../../ports';
import { createInvoice } from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';
import { OcrError } from '../../../domain/errors/ocr.errors';
import { LLMError } from '../../../domain/errors/llm.errors';

const INVOICE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const FAKE_PDF = Buffer.from('%PDF-1.4 fake pdf content');
const FAKE_TEXT = 'FACTURA 001\nTotal: 100,00 EUR';

const FAKE_LLM_RESULT = {
  total: 100.0,
  fecha: '2024-01-15',
  numeroFactura: 'FACT-001',
  nifEmisor: 'B12345678',
  nombreEmisor: 'Empresa S.L.',
  baseImponible: 82.64,
  iva: 17.36,
};

describe('ProcessInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let mockStorage: StoragePort;
  let mockOcr: OcrPort;
  let mockAudit: AuditPort;
  let mockLlm: LLMPort;
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

    mockLlm = {
      extractInvoiceData: vi.fn().mockResolvedValue(ok(FAKE_LLM_RESULT)),
    };

    useCase = new ProcessInvoiceUseCase(mockRepo, mockStorage, mockOcr, mockAudit, mockLlm);
  });

  describe('execute', () => {
    it('should transition invoice to EXTRACTED when OCR and LLM succeed', async () => {
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.EXTRACTED);
    });

    it('should store rawText and all 7 LLM fields in extractedData', async () => {
      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap().extractedData;
      expect(data?.rawText).toBe(FAKE_TEXT);
      expect(data?.total).toBe(100.0);
      expect(data?.fecha).toBe('2024-01-15');
      expect(data?.numeroFactura).toBe('FACT-001');
      expect(data?.nifEmisor).toBe('B12345678');
      expect(data?.nombreEmisor).toBe('Empresa S.L.');
      expect(data?.baseImponible).toBe(82.64);
      expect(data?.iva).toBe(17.36);
    });

    it('should transition invoice to VALIDATION_FAILED when OCR fails', async () => {
      mockOcr.extractText = vi.fn().mockResolvedValue(
        err(new OcrError('Tesseract could not read the document')),
      );

      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.VALIDATION_FAILED);
    });

    it('should transition invoice to VALIDATION_FAILED when LLM fails', async () => {
      mockLlm.extractInvoiceData = vi.fn().mockResolvedValue(
        err(new LLMError('AI Studio API error')),
      );

      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe(InvoiceStatusEnum.VALIDATION_FAILED);
    });

    it('should not call LLM when OCR fails', async () => {
      mockOcr.extractText = vi.fn().mockResolvedValue(
        err(new OcrError('Tesseract could not read the document')),
      );

      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockLlm.extractInvoiceData).not.toHaveBeenCalled();
    });

    it('should call LLM with the raw OCR text', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockLlm.extractInvoiceData).toHaveBeenCalledWith(FAKE_TEXT);
    });

    it('should return InvoiceNotFoundError when invoice does not exist', async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVOICE_NOT_FOUND');
    });

    it('should return InvalidStateTransitionError when invoice is not PENDING', async () => {
      const processingInvoice = createInvoice({ id: INVOICE_ID });
      processingInvoice.startProcessing()._unsafeUnwrap();
      mockRepo.findById = vi.fn().mockResolvedValue(processingInvoice);

      const result = await useCase.execute({ invoiceId: INVOICE_ID });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should load the PDF from storage using the invoice filePath', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockStorage.get).toHaveBeenCalledWith('uploads/test-invoice.pdf');
    });

    it('should persist the invoice after processing', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      // save is called twice: once for PROCESSING state, once for final state
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should record an audit event with action process', async () => {
      await useCase.execute({ invoiceId: INVOICE_ID });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'process', resourceId: INVOICE_ID }),
      );
    });
  });
});
