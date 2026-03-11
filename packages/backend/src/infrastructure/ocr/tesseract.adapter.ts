import { ok, err, Result } from 'neverthrow';
import { createWorker } from 'tesseract.js';
import { OcrPort, OcrResult } from '../../application/ports/ocr.port';
import { OcrError } from '../../domain/errors/ocr.errors';

/**
 * TesseractAdapter
 *
 * Implementación de OcrPort usando tesseract.js.
 *
 * Crea un worker de Tesseract por cada llamada, ejecuta el OCR sobre el
 * buffer recibido (que puede ser un PDF directamente) y termina el worker
 * al finalizar, tanto en caso de éxito como de error.
 *
 * Idiomas: español ('spa') + inglés ('eng') — cubre la mayoría de facturas.
 */
export class TesseractAdapter implements OcrPort {
  async extractText(buffer: Buffer): Promise<Result<OcrResult, OcrError>> {
    const worker = await createWorker(['spa', 'eng']);

    try {
      const { data } = await worker.recognize(buffer);

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

export const OCR_TOKEN = 'OcrPort';
