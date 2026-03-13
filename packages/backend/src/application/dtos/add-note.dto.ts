import { z } from 'zod';

export const AddNoteInputSchema = z.object({
  invoiceId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});
export type AddNoteInput = z.infer<typeof AddNoteInputSchema>;

export const AddNoteOutputSchema = z.object({
  noteId: z.string(),
  invoiceId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.date(),
});
export type AddNoteOutput = z.infer<typeof AddNoteOutputSchema>;
