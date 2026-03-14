export type InvoiceStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'EXTRACTED'
  | 'VALIDATION_FAILED'
  | 'READY_FOR_VALIDATION'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type UserRole = 'uploader' | 'validator' | 'approver' | 'admin';

// Matches backend InvoiceSummary (list) and GetInvoiceOutput (detail).
// Backend never returns vendorName, invoiceNumber, dueDate, currency, confidence,
// updatedAt, or lineItems — those fields do not exist.
export interface InvoiceExtractedData {
  total: number | null;
  fecha: string | null;           // invoice date extracted by LLM
  numeroFactura: string | null;   // invoice number extracted by LLM
  nombreEmisor: string | null;    // vendor/emitter name extracted by LLM
  nifEmisor: string | null;       // tax ID extracted by LLM
  baseImponible: number | null;   // net amount (before VAT)
  iva: number | null;             // VAT amount in euros (e.g. 91.59)
  ivaPorcentaje: number | null;   // VAT rate % (e.g. 21)
}

export interface Invoice {
  invoiceId: string;
  status: InvoiceStatus;
  uploaderId: string;
  uploaderEmail: string | null;
  validatorId: string | null;
  validatorEmail: string | null;
  approverId: string | null;
  approverEmail: string | null;
  providerId: string;
  vendorName: string | null;   // vendor name from extractedData (list response)
  filePath: string;
  amount: number;
  date: string;        // invoice date ISO string
  createdAt: string;
  rejectionReason: string | null;
  validationErrors: string[];
  extractedData: InvoiceExtractedData | null;
}

// Matches backend InvoiceEventOutput (from get-invoice-events.dto.ts).
// Fields: id, invoiceId, from, to, userId, timestamp
// No "type", "actorName", or "details" — those were demo-only.
export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  from: string;   // InvoiceStatus value the invoice transitioned FROM
  to: string;     // InvoiceStatus value the invoice transitioned TO
  userId: string;
  timestamp: string;
}

// UUID fijo del provider generic — hardcodeado en frontend y en seed
export const GENERIC_PROVIDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROVIDER_NAMES: Record<string, string> = {
  [GENERIC_PROVIDER_ID]: 'Generic (AI)',
};

/** Devuelve el nombre legible del provider dado su UUID. */
export function formatProviderName(providerId: string | null | undefined): string {
  if (!providerId) return '—';
  return PROVIDER_NAMES[providerId] ?? providerId.slice(0, 8) + '…';
}

