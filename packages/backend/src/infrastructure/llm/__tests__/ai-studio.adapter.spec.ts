import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock completo de @google/generative-ai ───────────────────────────────────
// vi.hoisted() garantiza que mockGenerateContent existe ANTES de que vi.mock()
// sea ejecutado (vi.mock se hoist al top del archivo automáticamente).
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return {
    GoogleGenerativeAI,
    SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' },
  };
});

import { AIStudioAdapter } from '../ai-studio.adapter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeApiResponse = (json: object) => ({
  response: { text: () => JSON.stringify(json) },
});

const VALID_EXTRACTION = {
  total: 121.0,
  fecha: '2024-03-15',
  numeroFactura: 'FAC-2024-001',
  nifEmisor: 'B12345678',
  nombreEmisor: 'Proveedor S.L.',
  baseImponible: 100.0,
  iva: 21.0,
};

const OCR_TEXT = 'FACTURA FAC-2024-001\nFecha: 15/03/2024\nTotal: 121,00 EUR';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIStudioAdapter', () => {
  let adapter: AIStudioAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AIStudioAdapter('fake-api-key', 'gemini-1.5-flash');
  });

  it('should return structured fields when the API responds correctly', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue(makeApiResponse(VALID_EXTRACTION));

    // Act
    const result = await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isOk()).toBe(true);
    const data = result._unsafeUnwrap();
    expect(data.total).toBe(121.0);
    expect(data.fecha).toBe('2024-03-15');
    expect(data.numeroFactura).toBe('FAC-2024-001');
    expect(data.nifEmisor).toBe('B12345678');
    expect(data.nombreEmisor).toBe('Proveedor S.L.');
    expect(data.baseImponible).toBe(100.0);
    expect(data.iva).toBe(21.0);
  });

  it('should return LLMError when the API throws an exception', async () => {
    // Arrange
    mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

    // Act
    const result = await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('LLM_ERROR');
    expect(result._unsafeUnwrapErr().message).toContain('API quota exceeded');
  });

  it('should return LLMError when the response is not valid JSON', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not valid json {{{' },
    });

    // Act
    const result = await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('LLM_ERROR');
  });

  it('should return null for fields the LLM cannot extract', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue(
      makeApiResponse({
        total: 250.0,
        fecha: null,
        numeroFactura: null,
        nifEmisor: null,
        nombreEmisor: 'Empresa Desconocida S.A.',
        baseImponible: null,
        iva: null,
      }),
    );

    // Act
    const result = await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isOk()).toBe(true);
    const data = result._unsafeUnwrap();
    expect(data.total).toBe(250.0);
    expect(data.fecha).toBeNull();
    expect(data.numeroFactura).toBeNull();
  });

  it('should parse total and baseImponible as numbers, not strings', async () => {
    // Arrange — el LLM podría devolver números como strings
    mockGenerateContent.mockResolvedValue(
      makeApiResponse({
        ...VALID_EXTRACTION,
        total: '121.00',
        baseImponible: '100',
      }),
    );

    // Act
    const result = await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isOk()).toBe(true);
    const data = result._unsafeUnwrap();
    expect(typeof data.total).toBe('number');
    expect(typeof data.baseImponible).toBe('number');
    expect(data.total).toBe(121.0);
    expect(data.baseImponible).toBe(100.0);
  });

  it('should include the OCR text in the prompt sent to the API', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue(makeApiResponse(VALID_EXTRACTION));

    // Act
    await adapter.extractInvoiceData(OCR_TEXT);

    // Assert
    const calledWith = mockGenerateContent.mock.calls[0][0] as string;
    expect(calledWith).toContain(OCR_TEXT);
  });

  it('should return LLMError immediately when API key is empty', async () => {
    // Arrange
    const adapterWithoutKey = new AIStudioAdapter('', 'gemini-1.5-flash');

    // Act
    const result = await adapterWithoutKey.extractInvoiceData(OCR_TEXT);

    // Assert
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('AISTUDIO_API_KEY');
  });
});
