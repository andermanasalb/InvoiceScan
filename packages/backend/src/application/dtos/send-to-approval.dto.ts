import { z } from 'zod';

export const SendToApprovalInputSchema = z.object({
  invoiceId: z.string().uuid(),
  validatorId: z.string().uuid(),
  validatorRole: z.enum(['validator', 'approver', 'admin']),
});
export type SendToApprovalInput = z.infer<typeof SendToApprovalInputSchema>;

export const SendToApprovalOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  validatorId: z.string(),
});
export type SendToApprovalOutput = z.infer<typeof SendToApprovalOutputSchema>;
