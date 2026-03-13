'use client';

import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';
import type { InvoiceEvent, InvoiceStatus } from '@/types/invoice';

const NON_POLLING_STATUSES: InvoiceStatus[] = [
  'APPROVED',
  'REJECTED',
  'VALIDATION_FAILED',
  'READY_FOR_APPROVAL',
];

export function useInvoiceEvents(id: string, currentStatus?: InvoiceStatus) {
  // Backend returns { data: InvoiceEvent[] } — queryFn returns InvoiceEvent[] directly
  return useQuery<InvoiceEvent[]>({
    queryKey: ['invoice-events', id],
    queryFn: async () => {
      const response = await invoiceApi.getEvents(id);
      // Backend envelope: { data: [...] }
      return response.data as InvoiceEvent[];
    },
    enabled: !!id,
    // Poll every 3s while invoice is still being processed
    refetchInterval: () => {
      if (!currentStatus) return false;
      if (NON_POLLING_STATUSES.includes(currentStatus)) return false;
      return 3000;
    },
  });
}
