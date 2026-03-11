import { z } from 'zod';

export const GetInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
});
export type GetInvoiceInput = z.infer<typeof GetInvoiceInputSchema>;

export const GetInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  uploaderId: z.string(),
  providerId: z.string(),
  filePath: z.string(),
  amount: z.number(),
  date: z.date(),
  createdAt: z.date(),
  approverId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  validationErrors: z.array(z.string()),
});
export type GetInvoiceOutput = z.infer<typeof GetInvoiceOutputSchema>;
