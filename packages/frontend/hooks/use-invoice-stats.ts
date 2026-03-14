/**
 * @file useInvoiceStats hook
 *
 * Fetches invoice counts grouped by status from the backend in a single
 * GET /invoices/stats request.  Replaces the previous pattern of calling
 * useInvoices() four times with different status filters (N+1 HTTP requests).
 *
 * - uploaders  → backend scopes counts to their own invoices
 * - all others → backend returns counts across all invoices
 */
import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';

/** Returns a map of InvoiceStatus string → number, plus React Query meta. */
export function useInvoiceStats() {
  return useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => invoiceApi.stats().then((r) => r.data),
    // Stats are cheap to refetch and rarely stale for more than 30 seconds.
    staleTime: 30_000,
  });
}
