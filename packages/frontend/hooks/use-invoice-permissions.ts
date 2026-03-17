/**
 * @file useInvoicePermissions hook.
 *
 * Centralises all role + ownership checks for a single invoice so that the
 * invoice-detail page doesn't have to repeat the same boolean expressions
 * in multiple places.
 */
'use client';

import type { Invoice } from '@invoice-flow/shared';

interface UseInvoicePermissionsParams {
  invoice: Invoice | undefined;
  role: string | null;
  userId: string | null;
}

export interface InvoicePermissions {
  /** User can approve or reject the invoice (approver/admin from READY_FOR_APPROVAL). */
  canApprove: boolean;
  /** Uploader (owner) or admin can reject from EXTRACTED. */
  canRejectAtExtracted: boolean;
  /** Validator/approver/admin can reject from READY_FOR_VALIDATION. */
  canRejectFromValidation: boolean;
  /** User can move EXTRACTED → READY_FOR_VALIDATION. */
  canSendToValidation: boolean;
  /** User can move READY_FOR_VALIDATION → READY_FOR_APPROVAL. */
  canSendToApproval: boolean;
  /** User can re-enqueue a VALIDATION_FAILED invoice. */
  canRetry: boolean;
  /** User can add a note to the invoice. */
  canAddNote: boolean;
}

/**
 * Returns a set of boolean flags describing what the current user is allowed
 * to do with the given invoice.
 *
 * All flags are `false` while the invoice is still loading (undefined).
 */
export function useInvoicePermissions({
  invoice,
  role,
  userId,
}: UseInvoicePermissionsParams): InvoicePermissions {
  const isAdmin = role === 'admin';
  const isOwner = !!userId && invoice?.uploaderId === userId;
  // The person who sent to validation cannot also send to approval
  const isValidator = !!userId && invoice?.validatorId === userId;

  const canApprove =
    (role === 'approver' || role === 'admin') &&
    invoice?.status === 'READY_FOR_APPROVAL' &&
    (isAdmin || (!isOwner && !isValidator));

  // Step 1: EXTRACTED → READY_FOR_VALIDATION
  // The uploader reviews AI-extracted data and sends it (their OWN invoice).
  // Validator/approver/admin can also do this on invoices they don't own.
  const canSendToValidation =
    invoice?.status === 'EXTRACTED' &&
    (isAdmin ||
      (role === 'uploader' && isOwner) ||
      ((role === 'validator' || role === 'approver') && !isOwner));

  // Step 2: READY_FOR_VALIDATION → READY_FOR_APPROVAL (validator/approver/admin, not the uploader)
  const canSendToApproval =
    (role === 'validator' || role === 'approver' || role === 'admin') &&
    invoice?.status === 'READY_FOR_VALIDATION' &&
    (isAdmin || !isOwner);

  // Uploader (owner) or admin can reject from EXTRACTED (cancellation)
  const canRejectAtExtracted =
    invoice?.status === 'EXTRACTED' &&
    (isAdmin || (role === 'uploader' && isOwner));

  // Validator/approver/admin can reject from READY_FOR_VALIDATION
  const canRejectFromValidation =
    (role === 'validator' || role === 'approver' || isAdmin) &&
    invoice?.status === 'READY_FOR_VALIDATION' &&
    (isAdmin || !isOwner);

  const canRetry =
    (role === 'validator' || role === 'approver' || role === 'admin') &&
    invoice?.status === 'VALIDATION_FAILED';

  const canAddNote =
    role === 'validator' || role === 'approver' || role === 'admin';

  return { canApprove, canRejectAtExtracted, canRejectFromValidation, canSendToValidation, canSendToApproval, canRetry, canAddNote };
}
