import { Result } from 'neverthrow';
import { OcrError } from '../../domain/errors/ocr.errors';

export interface OcrResult {
  /** Texto plano extraído del PDF */
  text: string;
  /** Nivel de confianza de Tesseract: 0-100 */
  confidence: number;
}

export interface OcrPort {
  extractText(buffer: Buffer): Promise<Result<OcrResult, OcrError>>;
}
