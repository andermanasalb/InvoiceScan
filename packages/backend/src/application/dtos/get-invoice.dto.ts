import { z } from 'zod';

export const GetInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
});
export type GetInvoiceInput = z.infer<typeof GetInvoiceInputSchema>;

const ExtractedDataOutputSchema = z.object({
  total: z.number().nullable(),
  fecha: z.string().nullable(),
  numeroFactura: z.string().nullable(),
  nombreEmisor: z.string().nullable(),
  nifEmisor: z.string().nullable(),
  baseImponible: z.number().nullable(),
  iva: z.number().nullable(),
  ivaPorcentaje: z.number().nullable(),
});

export const GetInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  uploaderId: z.string(),
  uploaderEmail: z.string().nullable(),
  providerId: z.string(),
  filePath: z.string(),
  amount: z.number(),
  date: z.date(),
  createdAt: z.date(),
  validatorId: z.string().nullable(),
  validatorEmail: z.string().nullable(),
  approverId: z.string().nullable(),
  approverEmail: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  validationErrors: z.array(z.string()),
  extractedData: ExtractedDataOutputSchema.nullable(),
});
export type GetInvoiceOutput = z.infer<typeof GetInvoiceOutputSchema>;
