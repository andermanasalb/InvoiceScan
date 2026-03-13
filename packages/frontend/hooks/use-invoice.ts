'use client';

import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';
import type { Invoice, InvoiceStatus } from '@/types/invoice';

const TERMINAL_STATUSES: InvoiceStatus[] = ['APPROVED', 'REJECTED', 'VALIDATION_FAILED'];
// EXTRACTED, READY_FOR_VALIDATION and READY_FOR_APPROVAL are human-gated — no need to poll further
const NON_POLLING_STATUSES: InvoiceStatus[] = [...TERMINAL_STATUSES, 'EXTRACTED', 'READY_FOR_VALIDATION', 'READY_FOR_APPROVAL'];

export function useInvoice(id: string) {
  // Backend returns { data: Invoice } — queryFn returns Invoice directly
  return useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await invoiceApi.getById(id);
      // Backend envelope: { data: { invoiceId, status, ... } }
      return response.data as Invoice;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const invoice = query.state.data;
      if (!invoice) return false;

      // Stop polling for terminal states and READY_FOR_APPROVAL
      if (NON_POLLING_STATUSES.includes(invoice.status)) {
        return false;
      }

      // Poll every 3 seconds while processing
      return 3000;
    },
  });
}
