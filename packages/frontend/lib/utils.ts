/**
 * @file Shared utility functions for the InvoiceScan frontend.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind class names, resolving conflicts via tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric amount as a Euro currency string using German locale
 * (period as thousands separator, comma as decimal separator).
 *
 * Returns '—' for null / undefined values.
 *
 * @example
 * formatAmount(1234.5)  // → '1.234,50 €'
 * formatAmount(null)    // → '—'
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
