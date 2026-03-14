import { z } from 'zod';

export const AssignUploaderInputSchema = z.object({
  uploaderId: z.string().uuid(),
  validatorId: z.string().uuid(),
  adminId: z.string().uuid(),
});
export type AssignUploaderInput = z.infer<typeof AssignUploaderInputSchema>;

export const AssignValidatorInputSchema = z.object({
  validatorId: z.string().uuid(),
  approverId: z.string().uuid(),
  adminId: z.string().uuid(),
});
export type AssignValidatorInput = z.infer<typeof AssignValidatorInputSchema>;

export const RemoveAssignmentInputSchema = z.object({
  type: z.enum(['uploader', 'validator']),
  /** The assignee whose assignment to remove: uploaderId or validatorId */
  assigneeId: z.string().uuid(),
});
export type RemoveAssignmentInput = z.infer<typeof RemoveAssignmentInputSchema>;
