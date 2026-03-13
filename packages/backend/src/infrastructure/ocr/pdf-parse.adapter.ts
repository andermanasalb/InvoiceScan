import { ok, err, Result } from 'neverthrow';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OcrPort, OcrResult } from '../../application/ports/ocr.port';
import { OcrError } from '../../domain/errors/ocr.errors';

/**
 * PdfParseAdapter
 *
 * Implementación de OcrPort usando pdfjs-dist.
 * Extrae el texto embebido de PDFs digitales (facturas generadas por software).
 *
 * No requiere dependencias nativas ni modelos de lenguaje.
 * Para PDFs escaneados (sin capa de texto) retorna texto vacío — el LLM
 * recibirá el string vacío y resultará en VALIDATION_FAILED como comportamiento
 * degradado esperado.
 *
 * Devuelve confidence=100 para PDFs con texto y confidence=0 si vacío.
 */
export class PdfParseAdapter implements OcrPort {
  async extractText(buffer: Buffer): Promise<Result<OcrResult, OcrError>> {
    try {
      const uint8 = new Uint8Array(buffer);
      const loadingTask = getDocument({
        data: uint8,
        // Silence the standardFontDataUrl warning — not needed for text extraction
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;
      const textParts: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        textParts.push(pageText);
      }

      const text = textParts.join('\n');
      const confidence = text.trim().length > 0 ? 100 : 0;

      return ok({ text, confidence });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      return err(new OcrError(reason));
    }
  }
}

export const OCR_TOKEN = 'OcrPort';
