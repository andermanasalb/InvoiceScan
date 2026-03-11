import { z } from 'zod';

export const RejectInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  approverId: z.string().uuid(),
  reason: z.string().min(1, { message: 'Rejection reason cannot be empty' }),
});
export type RejectInvoiceInput = z.infer<typeof RejectInvoiceInputSchema>;

export const RejectInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  approverId: z.string(),
  reason: z.string(),
});
export type RejectInvoiceOutput = z.infer<typeof RejectInvoiceOutputSchema>;
