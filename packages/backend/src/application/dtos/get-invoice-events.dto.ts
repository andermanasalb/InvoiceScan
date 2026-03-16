import { z } from 'zod';

export const GetInvoiceEventsInputSchema = z.object({
  invoiceId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
});
export type GetInvoiceEventsInput = z.infer<typeof GetInvoiceEventsInputSchema>;

export const InvoiceEventOutputSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  from: z.string(),
  to: z.string(),
  userId: z.string(),
  userEmail: z.string().nullable(),
  timestamp: z.date(),
});
export type InvoiceEventOutput = z.infer<typeof InvoiceEventOutputSchema>;

export type GetInvoiceEventsOutput = InvoiceEventOutput[];
