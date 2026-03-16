'use client';

import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';

export interface InvoiceNote {
  noteId: string;
  invoiceId: string;
  authorId: string;
  authorEmail?: string | null;
  content: string;
  createdAt: string;
}

export function useInvoiceNotes(id: string) {
  return useQuery<InvoiceNote[]>({
    queryKey: ['invoice-notes', id],
    queryFn: async () => {
      const response = await invoiceApi.getNotes(id);
      return response.data as InvoiceNote[];
    },
    enabled: !!id,
  });
}
