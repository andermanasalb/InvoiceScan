import { z } from 'zod';

export const ExportInvoicesInputSchema = z.object({
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
  format: z.enum(['csv', 'json']),
  status: z.string().optional(),
  sort: z.string().optional(),
});
export type ExportInvoicesInput = z.infer<typeof ExportInvoicesInputSchema>;

export const ExportInvoicesOutputSchema = z.object({
  jobId: z.string().uuid(),
});
export type ExportInvoicesOutput = z.infer<typeof ExportInvoicesOutputSchema>;
