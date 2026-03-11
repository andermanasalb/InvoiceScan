export interface LLMExtractionResult {
  providerName?: string;
  taxId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;   // ISO date string
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  rawText?: string;
}

export interface LLMPort {
  extractInvoiceData(pdfText: string): Promise<LLMExtractionResult>;
}
