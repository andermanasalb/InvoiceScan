import { z } from 'zod';

export const RetryInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  requesterId: z.string().uuid(),
});
export type RetryInvoiceInput = z.infer<typeof RetryInvoiceInputSchema>;

export const RetryInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
});
export type RetryInvoiceOutput = z.infer<typeof RetryInvoiceOutputSchema>;
