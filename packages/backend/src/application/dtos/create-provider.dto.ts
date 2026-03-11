import { z } from 'zod';

export const CreateProviderInputSchema = z.object({
  name: z.string().min(1).max(100),
  adapterType: z.enum(['telefonica', 'amazon', 'generic']),
});
export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;

export const CreateProviderOutputSchema = z.object({
  providerId: z.string(),
  name: z.string(),
  adapterType: z.string(),
  createdAt: z.date(),
});
export type CreateProviderOutput = z.infer<typeof CreateProviderOutputSchema>;
