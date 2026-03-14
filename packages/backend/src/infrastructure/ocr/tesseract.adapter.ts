/**
 * @file TesseractAdapter
 *
 * Alternate OcrPort implementation using tesseract.js (image/scanned PDFs).
 *
 * NOT currently registered in any NestJS module — the active implementation is
 * PdfParseAdapter (pdf-parse.adapter.ts), which handles text-embedded PDFs without
 * native dependencies.
 *
 * Activate by swapping the OcrPort provider in InvoicesModule / JobsModule when
 * support for scanned, image-only PDFs is required.
 */
import { ok, err, Result } from 'neverthrow';
import { createWorker } from 'tesseract.js';
import { OcrPort, OcrResult } from '../../application/ports/ocr.port';
import { OcrError } from '../../domain/errors/ocr.errors';

// NOTE: OCR_TOKEN is intentionally NOT exported from this file.
// The canonical token lives in pdf-parse.adapter.ts (the active OcrPort impl).
// Exporting it here too would create a duplicate-export collision if both files
// are imported in the same module context.

const OCR_TIMEOUT_MS = 60_000;

export class TesseractAdapter implements OcrPort {
  async extractText(buffer: Buffer): Promise<Result<OcrResult, OcrError>> {
    const worker = await createWorker(['spa', 'eng']);

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`OCR timed out after ${OCR_TIMEOUT_MS / 1000}s`)),
          OCR_TIMEOUT_MS,
        ),
      );

      const { data } = await Promise.race([worker.recognize(buffer), timeout]);

      return ok({
        text: data.text,
        confidence: data.confidence,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      return err(new OcrError(reason));
    } finally {
      // Siempre liberamos el worker, aunque haya fallado
      await worker.terminate();
    }
  }
}

// OCR_TOKEN deliberately not exported — see file-level comment above.
