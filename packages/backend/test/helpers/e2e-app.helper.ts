/**
 * e2e-app.helper.ts
 *
 * Creates a NestJS application using the real AppModule with one substitution:
 *   LLM_TOKEN is overridden with a deterministic stub so E2E tests don't need
 *   AISTUDIO_API_KEY and don't make real network calls.
 *
 * All other dependencies (PostgreSQL, Redis, BullMQ workers, guards, filters)
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
import { AppModule } from '../../src/app.module';
import { DomainErrorFilter } from '../../src/interface/http/filters/domain-error.filter';
import { LLM_TOKEN } from '../../src/application/ports/llm.port';
import type { LLMPort, LLMExtractionResult } from '../../src/application/ports/llm.port';

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
    .compile();

  const app = moduleRef.createNestApplication();

  // Apply the same middleware / filters as main.ts
  app.use(cookieParser());
  app.useGlobalFilters(new DomainErrorFilter());

  await app.init();

  return { app, http: app.getHttpServer() };
}
