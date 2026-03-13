import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfjs-dist before importing the adapter
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
}));

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfParseAdapter } from '../pdf-parse.adapter';

const FAKE_PDF_BUFFER = Buffer.from('%PDF-1.4 fake content');

function makeMockPdf(pages: string[][]) {
  return {
    numPages: pages.length,
    getPage: vi.fn().mockImplementation(async (num: number) => ({
      getTextContent: vi.fn().mockResolvedValue({
        items: pages[num - 1].map((str) => ({ str })),
      }),
    })),
  };
}

describe('PdfParseAdapter', () => {
  let adapter: PdfParseAdapter;

  beforeEach(() => {
    adapter = new PdfParseAdapter();
    vi.clearAllMocks();
  });

  describe('extractText', () => {
    it('should return ok with extracted text when PDF has a text layer', async () => {
      const mockPdf = makeMockPdf([['FACTURA 001', 'Total: 121,00 EUR']]);
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as never);

      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().text).toContain('FACTURA 001');
      expect(result._unsafeUnwrap().text).toContain('Total: 121,00 EUR');
      expect(result._unsafeUnwrap().confidence).toBe(100);
    });

    it('should concatenate text from multiple pages', async () => {
      const mockPdf = makeMockPdf([['Pagina 1'], ['Pagina 2']]);
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as never);

      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isOk()).toBe(true);
      const text = result._unsafeUnwrap().text;
      expect(text).toContain('Pagina 1');
      expect(text).toContain('Pagina 2');
    });

    it('should return confidence=0 when PDF has no text layer', async () => {
      const mockPdf = makeMockPdf([['   ']]);
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as never);

      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().confidence).toBe(0);
    });

    it('should return err(OcrError) when pdfjs throws', async () => {
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF structure')),
      } as never);

      const result = await adapter.extractText(FAKE_PDF_BUFFER);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('OCR_FAILED');
    });

    it('should pass the buffer as Uint8Array to pdfjs', async () => {
      const mockPdf = makeMockPdf([['texto']]);
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as never);

      await adapter.extractText(FAKE_PDF_BUFFER);

      expect(pdfjs.getDocument).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Uint8Array) }),
      );
    });
  });
});
