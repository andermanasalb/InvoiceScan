import { z } from 'zod';

export const ListInvoicesInputSchema = z.object({
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
  status: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(), // e.g. 'createdAt:desc'
});
export type ListInvoicesInput = z.infer<typeof ListInvoicesInputSchema>;

export const InvoiceSummarySchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  uploaderId: z.string(),
  providerId: z.string(),
  amount: z.number(),
  date: z.date(),
  createdAt: z.date(),
});
export type InvoiceSummary = z.infer<typeof InvoiceSummarySchema>;

export const ListInvoicesOutputSchema = z.object({
  items: z.array(InvoiceSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export type ListInvoicesOutput = z.infer<typeof ListInvoicesOutputSchema>;
