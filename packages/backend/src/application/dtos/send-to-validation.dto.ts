import { z } from 'zod';

export const SendToValidationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  validatorId: z.string().uuid(),
  validatorRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
});
export type SendToValidationInput = z.infer<typeof SendToValidationInputSchema>;

export const SendToValidationOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  validatorId: z.string(),
});
export type SendToValidationOutput = z.infer<typeof SendToValidationOutputSchema>;
