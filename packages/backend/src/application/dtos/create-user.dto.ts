import { z } from 'zod';

export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  role: z.enum(['uploader', 'validator', 'approver', 'admin']),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' }),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const CreateUserOutputSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.date(),
});
export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;
