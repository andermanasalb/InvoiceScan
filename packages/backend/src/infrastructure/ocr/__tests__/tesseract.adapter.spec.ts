import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok, err } from 'neverthrow';

// Mockeamos tesseract.js completo antes de importar el adapter
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

import * as Tesseract from 'tesseract.js';
import { TesseractAdapter } from '../tesseract.adapter';

const FAKE_PDF_BUFFER = Buffer.from('%PDF-1.4 fake content');

describe('TesseractAdapter', () => {
  let adapter: TesseractAdapter;
  let mockWorker: { recognize: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockWorker = {
      recognize: vi.fn().mockResolvedValue({
        data: { text: 'FACTURA 001\nTotal: 121,00 EUR', confidence: 87 },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Tesseract.createWorker).mockResolvedValue(mockWorker as unknown as Tesseract.Worker);

    adapter = new TesseractAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extractText', () => {
    it('should return ok with text and confidence when OCR succeeds', async () => {
      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().text).toBe('FACTURA 001\nTotal: 121,00 EUR');
      expect(result._unsafeUnwrap().confidence).toBe(87);
    });

    it('should call tesseract with the provided buffer', async () => {
      await adapter.extractText(FAKE_PDF_BUFFER);

      expect(mockWorker.recognize).toHaveBeenCalledWith(FAKE_PDF_BUFFER);
    });

    it('should terminate the worker after extraction', async () => {
      await adapter.extractText(FAKE_PDF_BUFFER);

      expect(mockWorker.terminate).toHaveBeenCalledOnce();
    });

    it('should terminate the worker even if OCR throws', async () => {
      mockWorker.recognize = vi.fn().mockRejectedValue(new Error('Tesseract internal error'));

      await adapter.extractText(FAKE_PDF_BUFFER);

      expect(mockWorker.terminate).toHaveBeenCalledOnce();
    });

    it('should return err(OcrError) when tesseract throws', async () => {
      mockWorker.recognize = vi.fn().mockRejectedValue(new Error('Tesseract internal error'));

      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('OCR_FAILED');
    });

    it('should create a worker with Spanish and English languages', async () => {
      await adapter.extractText(FAKE_PDF_BUFFER);

      expect(Tesseract.createWorker).toHaveBeenCalledWith(['spa', 'eng']);
    });
  });
});
