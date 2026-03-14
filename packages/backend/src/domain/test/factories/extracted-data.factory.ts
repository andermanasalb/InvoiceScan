import type { ExtractedData } from '../../entities/invoice.entity';

export const createExtractedData = (
  overrides?: Partial<ExtractedData>,
): ExtractedData => ({
  rawText: 'sample raw text',
  total: null,
  fecha: null,
  numeroFactura: null,
  nifEmisor: null,
  nombreEmisor: null,
  baseImponible: null,
  iva: null,
  ivaPorcentaje: null,
  ...overrides,
});
