import { z } from 'zod';

export const ApproveInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  approverId: z.string().uuid(),
});
export type ApproveInvoiceInput = z.infer<typeof ApproveInvoiceInputSchema>;

export const ApproveInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  approverId: z.string(),
});
export type ApproveInvoiceOutput = z.infer<typeof ApproveInvoiceOutputSchema>;
