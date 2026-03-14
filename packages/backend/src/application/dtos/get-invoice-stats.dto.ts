/**
 * @file DTOs for the GetInvoiceStats use case.
 *
 * The input carries the requester's identity so that the use case can scope
 * the counts to the uploader's own invoices when the role is `uploader`.
 */
import { z } from 'zod';

/** Input DTO — identifies who is requesting the stats. */
export const GetInvoiceStatsInputSchema = z.object({
  requesterId: z.string().uuid(),
  requesterRole: z.enum(['uploader', 'validator', 'approver', 'admin']),
});

export type GetInvoiceStatsInput = z.infer<typeof GetInvoiceStatsInputSchema>;

/**
 * Output DTO — a map of InvoiceStatus → count.
 * Zero-count statuses are omitted to keep the payload small.
 */
export type GetInvoiceStatsOutput = Record<string, number>;
