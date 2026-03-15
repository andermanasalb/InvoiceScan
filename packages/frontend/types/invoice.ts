/**
 * Re-exports from @invoice-flow/shared — single source of truth.
 * This file exists only for backwards compatibility with existing imports.
 * Prefer importing directly from '@invoice-flow/shared' in new code.
 */
export type {
  UserRole,
  InvoiceStatus,
  InvoiceExtractedData,
  Invoice,
  InvoiceEvent,
} from '@invoice-flow/shared';

export { GENERIC_PROVIDER_ID, formatProviderName } from '@invoice-flow/shared';
