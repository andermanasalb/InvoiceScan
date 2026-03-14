import { z } from 'zod';

export const ListUsersInputSchema = z.object({
  role: z.enum(['uploader', 'validator', 'approver', 'admin']).optional(),
});
export type ListUsersInput = z.infer<typeof ListUsersInputSchema>;

export const UserSummarySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['uploader', 'validator', 'approver', 'admin']),
  createdAt: z.date(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const ListUsersOutputSchema = z.object({
  users: z.array(UserSummarySchema),
});
export type ListUsersOutput = z.infer<typeof ListUsersOutputSchema>;
