'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { invoiceApi } from '@/lib/api';
import type { AxiosError } from 'axios';
import type { ApiError } from '@invoice-flow/shared';

export type ExportFormat = 'csv' | 'json';

export interface ExportFilters {
  format: ExportFormat;
  status?: string;
  sort?: string;
}

export type ExportJobStatus = 'pending' | 'processing' | 'done' | 'failed';

/**
 * useExportStatus
 *
 * Polls GET /api/v1/exports/:jobId/status every 2s until the job is
 * done or failed, then stops polling.
 */
export function useExportStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['export-status', jobId],
    queryFn: () => invoiceApi.getExportStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === 'done' || status === 'failed') return false;
      return 2000;
    },
    select: (res) => res.data,
  });
}

/**
 * useExportInvoices
 *
 * Mutation that:
 *   1. Calls POST /invoices/export → gets { jobId }
 *   2. Stores the jobId in state so useExportStatus can poll it
 *   3. Shows a loading toast, updates to success+download or error
 */
export function useExportInvoices() {
  const [jobId, setJobId] = useState<string | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  const statusQuery = useExportStatus(jobId);

  // React to status changes
  const handleStatusChange = useCallback(
    (status: ExportJobStatus, downloadUrl: string | null, format: string | null) => {
      if (status === 'done' && downloadUrl) {
        if (toastIdRef.current !== null) {
          toast.dismiss(toastIdRef.current);
        }
        const ext = format === 'json' ? 'json' : 'csv';
        const fullUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'}${downloadUrl}`;
        // Trigger browser download
        const a = document.createElement('a');
        a.href = fullUrl;
        a.download = `invoices-export.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast.success(`Export ready — downloading ${ext.toUpperCase()}`);
        setJobId(null);
        toastIdRef.current = null;
      } else if (status === 'failed') {
        if (toastIdRef.current !== null) {
          toast.dismiss(toastIdRef.current);
        }
        toast.error('Export failed. Please try again.');
        setJobId(null);
        toastIdRef.current = null;
      }
    },
    [],
  );

  // Watch status changes
  if (
    statusQuery.data &&
    (statusQuery.data.status === 'done' || statusQuery.data.status === 'failed')
  ) {
    handleStatusChange(
      statusQuery.data.status,
      statusQuery.data.downloadUrl,
      statusQuery.data.format,
    );
  }

  const mutation = useMutation({
    mutationFn: (filters: ExportFilters) =>
      invoiceApi.export({
        format: filters.format,
        status: filters.status,
        sort: filters.sort,
      }),
    onMutate: () => {
      const id = toast.loading('Preparing export…');
      toastIdRef.current = id;
    },
    onSuccess: (res) => {
      setJobId(res.data.jobId);
    },
    onError: (error: AxiosError<ApiError>) => {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
      }
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to start export',
      );
      toastIdRef.current = null;
    },
  });

  return {
    exportInvoices: mutation.mutate,
    isPending: mutation.isPending || (!!jobId && statusQuery.data?.status !== 'done' && statusQuery.data?.status !== 'failed'),
    jobId,
  };
}
