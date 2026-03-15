/**
 * @file @invoice-flow/shared
 *
 * Single source of truth for types and Zod schemas shared between the
 * backend (NestJS) and the frontend (Next.js).
 *
 * Rules:
 *  - Only export things consumed by BOTH packages.
 *  - No framework-specific imports (no NestJS, no React).
 *  - Zod is the only allowed dependency.
 */

import { z } from 'zod';

// ── Roles ─────────────────────────────────────────────────────────────────────

export const USER_ROLES = ['uploader', 'validator', 'approver', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const UserRoleSchema = z.enum(USER_ROLES);

// ── Invoice status ─────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'EXTRACTED',
  'VALIDATION_FAILED',
  'READY_FOR_VALIDATION',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const InvoiceStatusSchema = z.enum(INVOICE_STATUSES);

// ── Extracted data (LLM output) ───────────────────────────────────────────────

export const InvoiceExtractedDataSchema = z.object({
  total: z.number().nullable(),
  fecha: z.string().nullable(),
  numeroFactura: z.string().nullable(),
  nombreEmisor: z.string().nullable(),
  nifEmisor: z.string().nullable(),
  baseImponible: z.number().nullable(),
  iva: z.number().nullable(),
  ivaPorcentaje: z.number().nullable(),
});
export type InvoiceExtractedData = z.infer<typeof InvoiceExtractedDataSchema>;

// ── Invoice API response shapes ───────────────────────────────────────────────

/**
 * Shape returned by GET /api/v1/invoices (list) and
 * GET /api/v1/invoices/:id (detail).
 *
 * Dates are serialised as ISO strings over the wire.
 */
export const InvoiceSchema = z.object({
  invoiceId: z.string(),
  status: InvoiceStatusSchema,
  uploaderId: z.string(),
  uploaderEmail: z.string().nullable(),
  validatorId: z.string().nullable(),
  validatorEmail: z.string().nullable(),
  approverId: z.string().nullable(),
  approverEmail: z.string().nullable(),
  providerId: z.string(),
  /** vendor name from extractedData (populated in list response) */
  vendorName: z.string().nullable(),
  filePath: z.string(),
  amount: z.number(),
  /** ISO date string */
  date: z.string(),
  /** ISO datetime string */
  createdAt: z.string(),
  rejectionReason: z.string().nullable(),
  validationErrors: z.array(z.string()),
  extractedData: InvoiceExtractedDataSchema.nullable(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// ── Invoice event ─────────────────────────────────────────────────────────────

export const InvoiceEventSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  from: z.string(),
  to: z.string(),
  userId: z.string(),
  /** ISO datetime string */
  timestamp: z.string(),
});
export type InvoiceEvent = z.infer<typeof InvoiceEventSchema>;

// ── Invoice note ──────────────────────────────────────────────────────────────

export const InvoiceNoteSchema = z.object({
  noteId: z.string(),
  invoiceId: z.string(),
  authorId: z.string(),
  content: z.string(),
  /** ISO datetime string */
  createdAt: z.string(),
});
export type InvoiceNote = z.infer<typeof InvoiceNoteSchema>;

// ── User / admin ──────────────────────────────────────────────────────────────

export const UserSummarySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  /** ISO datetime string */
  createdAt: z.string(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

// Assignment tree nodes

export const UserNodeSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
});
export type UserNode = z.infer<typeof UserNodeSchema>;

export const ValidatorNodeSchema = UserNodeSchema.extend({
  uploaders: z.array(UserNodeSchema),
});
export type ValidatorNode = z.infer<typeof ValidatorNodeSchema>;

export const ApproverNodeSchema = UserNodeSchema.extend({
  validators: z.array(ValidatorNodeSchema),
});
export type ApproverNode = z.infer<typeof ApproverNodeSchema>;

export const AssignmentTreeSchema = z.object({
  unassignedUploaders: z.array(UserNodeSchema),
  unassignedValidators: z.array(UserNodeSchema),
  unassignedApprovers: z.array(UserNodeSchema),
  approvers: z.array(ApproverNodeSchema),
});
export type AssignmentTree = z.infer<typeof AssignmentTreeSchema>;

// ── Auth API response shapes ───────────────────────────────────────────────────

export const LoginResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    userId: z.string(),
    role: UserRoleSchema,
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
  }),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// ── Generic API wrappers ──────────────────────────────────────────────────────

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema });

export interface ApiResponse<T> {
  data: T;
}

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
    }),
  });

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

// ── Export job ────────────────────────────────────────────────────────────────

export const ExportStatusSchema = z.object({
  data: z.object({
    status: z.enum(['pending', 'processing', 'done', 'failed']),
    progress: z.number(),
    downloadUrl: z.string().nullable(),
    format: z.string().nullable(),
  }),
});
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

// ── Provider constants ────────────────────────────────────────────────────────

/** Fixed UUID for the generic/AI provider — seeded in every environment. */
export const GENERIC_PROVIDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROVIDER_NAMES: Record<string, string> = {
  [GENERIC_PROVIDER_ID]: 'Generic (AI)',
};

/** Returns the human-readable provider name for a given provider UUID. */
export function formatProviderName(providerId: string | null | undefined): string {
  if (!providerId) return '—';
  return PROVIDER_NAMES[providerId] ?? providerId.slice(0, 8) + '…';
}
