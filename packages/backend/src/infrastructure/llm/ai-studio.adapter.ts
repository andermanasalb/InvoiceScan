import { ok, err, Result } from 'neverthrow';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type {
  LLMPort,
  LLMExtractionResult,
} from '../../application/ports/llm.port';
import { LLMError } from '../../domain/errors/llm.errors';

// ─── Zod schema para validar y coercionar la respuesta del LLM ───────────────

const ExtractionSchema = z.object({
  total: z.union([z.number(), z.string().transform(Number)]).nullable(),
  fecha: z.string().nullable(),
  numeroFactura: z.string().nullable(),
  nifEmisor: z.string().nullable(),
  nombreEmisor: z.string().nullable(),
  baseImponible: z.union([z.number(), z.string().transform(Number)]).nullable(),
  iva: z.union([z.number(), z.string().transform(Number)]).nullable(),
});

// ─── Prompt ──────────────────────────────────────────────────────────────────

const buildPrompt = (ocrText: string): string =>
  `
Eres un asistente experto en extracción de datos de facturas españolas.

A continuación tienes el texto extraído por OCR de una factura. Tu tarea es
identificar y devolver exactamente los siguientes campos en formato JSON.

Reglas:
- Si no encuentras un campo, devuelve null para ese campo.
- "total" y "baseImponible" deben ser números decimales (no strings).
- "iva" es el porcentaje de IVA aplicado (p.ej. 21 para 21%).
- "fecha" debe estar en formato ISO YYYY-MM-DD.
- "nifEmisor" es el NIF o CIF del emisor de la factura.
- Devuelve ÚNICAMENTE el JSON, sin explicaciones ni markdown.

Texto OCR de la factura:
---
${ocrText}
---

Responde con este JSON (y nada más):
{
  "total": <number|null>,
  "fecha": <"YYYY-MM-DD"|null>,
  "numeroFactura": <string|null>,
  "nifEmisor": <string|null>,
  "nombreEmisor": <string|null>,
  "baseImponible": <number|null>,
  "iva": <number|null>
}
`.trim();

// ─── Adapter ─────────────────────────────────────────────────────────────────

const LLM_TIMEOUT_MS = 30_000;

export class AIStudioAdapter implements LLMPort {
  private readonly client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-1.5-flash',
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async extractInvoiceData(
    ocrText: string,
  ): Promise<Result<LLMExtractionResult, LLMError>> {
    // Fallo rápido si no hay API key configurada
    if (!this.apiKey) {
      return err(
        new LLMError(
          'AISTUDIO_API_KEY no está configurada. ' +
            'Añade AISTUDIO_API_KEY al .env para habilitar la extracción LLM.',
        ),
      );
    }

    try {
      const generativeModel = this.client.getGenerativeModel({
        model: this.model,
      });

      const prompt = buildPrompt(ocrText);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`LLM timed out after ${LLM_TIMEOUT_MS / 1000}s`)),
          LLM_TIMEOUT_MS,
        ),
      );

      const response = await Promise.race([
        generativeModel.generateContent(prompt),
        timeout,
      ]);
      const rawText = response.response.text();

      // Eliminar posibles markdown fences (```json ... ```) que devuelva el LLM
      const cleaned = rawText.replace(/```(?:json)?/gi, '').trim();

      // Parsear JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return err(
          new LLMError(
            `La respuesta del LLM no es JSON válido: ${cleaned.slice(0, 200)}`,
          ),
        );
      }

      // Validar y coercionar con Zod
      const validation = ExtractionSchema.safeParse(parsed);
      if (!validation.success) {
        return err(
          new LLMError(
            `El JSON del LLM no tiene el shape esperado: ${validation.error.message}`,
          ),
        );
      }

      return ok(validation.data as LLMExtractionResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new LLMError(`Error llamando a Google AI Studio: ${message}`));
    }
  }
}
