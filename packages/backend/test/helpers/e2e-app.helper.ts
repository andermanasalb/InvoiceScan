/**
 * e2e-app.helper.ts
 *
 * Creates a NestJS application using the real AppModule with these substitutions:
 *   - LLM_TOKEN → deterministic stub (no AISTUDIO_API_KEY required, no network calls)
 *   - OCR_TOKEN → stub returning empty text (pdfjs-dist rejects minimal test PDFs)
 *   - ThrottlerGuard → disabled (prevents 429s in login-heavy test suites)
 *
 * All other dependencies (PostgreSQL, Redis, BullMQ workers, JWT/RBAC guards, filters)
 * are REAL — this is the same application that runs in production.
 *
 * Usage:
 *   const { app, http } = await createE2EApp();
 *   // ... run tests ...
 *   await app.close();
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ok } from 'neverthrow';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { DomainErrorFilter } from '../../src/interface/http/filters/domain-error.filter';
import { LLM_TOKEN } from '../../src/application/ports/llm.port';
import type { LLMPort, LLMExtractionResult } from '../../src/application/ports/llm.port';
import { OCR_TOKEN } from '../../src/infrastructure/ocr/pdf-parse.adapter';
import type { OcrPort } from '../../src/application/ports/ocr.port';

/**
 * Deterministic LLM stub.
 * Returns realistic invoice data without calling Google AI Studio.
 */
export const stubLlmResult: LLMExtractionResult = {
  total: 1210.0,
  fecha: '2025-03-01',
  numeroFactura: 'FACT-E2E-001',
  nifEmisor: '12345678A',
  nombreEmisor: 'Test Vendor S.L.',
  baseImponible: 1000.0,
  iva: 210.0,
  ivaPorcentaje: 21,
};

export const stubLlmAdapter: LLMPort = {
  extractInvoiceData: () => Promise.resolve(ok(stubLlmResult)),
};

/**
 * OCR stub — returns empty text so the LLM stub can provide all invoice data.
 * The real PdfParseAdapter (pdfjs-dist) rejects structurally minimal test PDFs;
 * stubbing OCR avoids that failure while still exercising the full LLM → EXTRACTED path.
 */
export const stubOcrAdapter: OcrPort = {
  extractText: () => Promise.resolve(ok({ text: '', confidence: 0 })),
};

export interface E2EApp {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
}

export async function createE2EApp(): Promise<E2EApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LLM_TOKEN)
    .useValue(stubLlmAdapter)
    .overrideProvider(OCR_TOKEN)
    .useValue(stubOcrAdapter)
    // Disable the throttler so login-heavy tests don't hit the 5/min limit.
    // JWT auth and RBAC guards are NOT affected — they run via separate APP_GUARDs.
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();

  // Apply the same middleware / filters as main.ts
  app.use(cookieParser());
  app.useGlobalFilters(new DomainErrorFilter());

  await app.init();

  return { app, http: app.getHttpServer() };
}
