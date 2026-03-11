import { Result } from 'neverthrow';
import { LLMError } from '../../domain/errors/llm.errors';

/**
 * Campos estructurados que el LLM extrae del texto OCR de una factura.
 * Todos son nullable — el LLM puede no encontrar algún campo.
 */
export interface LLMExtractionResult {
  total: number | null;
  fecha: string | null;         // formato 'YYYY-MM-DD'
  numeroFactura: string | null;
  nifEmisor: string | null;
  nombreEmisor: string | null;
  baseImponible: number | null;
  iva: number | null;
}

export interface LLMPort {
  extractInvoiceData(ocrText: string): Promise<Result<LLMExtractionResult, LLMError>>;
}

export const LLM_TOKEN = 'LLMPort';
