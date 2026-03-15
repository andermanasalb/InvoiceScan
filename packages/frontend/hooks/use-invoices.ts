'use client';

import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';
import type { Invoice, InvoiceStatus } from '@invoice-flow/shared';

interface UseInvoicesParams {
  status?: InvoiceStatus | 'ALL';
  page?: number;
  limit?: number;
  sort?: string;
}

// Matches the real backend envelope: { data: Invoice[], meta: { total, page, limit } }
interface UseInvoicesResponse {
  data: Invoice[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export function useInvoices(params: UseInvoicesParams = {}) {
  const { status, page = 1, limit = 20, sort = 'createdAt:desc' } = params;

  return useQuery<UseInvoicesResponse>({
    queryKey: ['invoices', { status, page, limit, sort }],
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {
        page,
        limit,
        sort,
      };
      if (status && status !== 'ALL') {
        queryParams.status = status;
      }
      const response = await invoiceApi.list(queryParams);
      // Backend returns { data: [...], meta: { total, page, limit } }
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
