'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoiceApi } from '@/lib/api';
import { AxiosError } from 'axios';
import type { ApiError } from '@/types/auth';
import { GENERIC_PROVIDER_ID } from '@/types/invoice';

export function useApproveInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoiceApi.approve(id),
    onSuccess: (_, id) => {
      toast.success('Invoice approved');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-events', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      const code = error.response?.data?.error?.code;
      if (code === 'WRONG_STATE' || error.response?.status === 409) {
        toast.error('Invoice is no longer in approval state. Refresh the page.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to approve invoice');
      }
    },
  });
}

export function useRejectInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      invoiceApi.reject(id, reason),
    onSuccess: (_, { id }) => {
      toast.success('Invoice rejected');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-events', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reject invoice');
    },
  });
}

export function useSendToApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoiceApi.sendToApproval(id),
    onSuccess: (_, id) => {
      toast.success('Invoice sent for approval');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-events', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      const code = error.response?.data?.error?.code;
      if (code === 'WRONG_STATE' || error.response?.status === 409) {
        toast.error('Invoice is not in READY_FOR_VALIDATION state. Refresh the page.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to send invoice for approval');
      }
    },
  });
}

export function useSendToValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoiceApi.sendToValidation(id),
    onSuccess: (_, id) => {
      toast.success('Invoice sent for validation');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-events', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      const code = error.response?.data?.error?.code;
      if (code === 'WRONG_STATE' || error.response?.status === 409) {
        toast.error('Invoice is not in EXTRACTED state. Refresh the page.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to send invoice for validation');
      }
    },
  });
}

export function useRetryInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoiceApi.retry(id),
    onSuccess: (_, id) => {
      toast.success('Invoice queued for reprocessing');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-events', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(error.response?.data?.error?.message || 'Failed to retry invoice');
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      invoiceApi.addNote(id, content),
    onSuccess: (_, { id }) => {
      toast.success('Note added');
      queryClient.invalidateQueries({ queryKey: ['invoice-notes', id] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(error.response?.data?.error?.message || 'Failed to add note');
    },
  });
}

export function useUploadInvoice() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    // providerId siempre es el provider generic — la detección de proveedor
    // real ocurre en el backend tras OCR + LLM
    mutationFn: ({ file }: { file: File }) =>
      invoiceApi.upload(file, GENERIC_PROVIDER_ID),
    onSuccess: (response) => {
      toast.success('Invoice uploaded! Processing started...');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      // Navigate to the detail page
      const invoiceId = response.data?.invoiceId;
      if (invoiceId) {
        router.push(`/invoices/${invoiceId}`);
      } else {
        router.push('/invoices');
      }
    },
    onError: (error: AxiosError<ApiError>) => {
      const status = error.response?.status;
      const code = error.response?.data?.error?.code;
      
      if (status === 400) {
        if (code === 'INVALID_FILE') {
          toast.error('Invalid file. Must be a PDF under 10 MB.');
        } else if (code === 'INVALID_PROVIDER') {
          toast.error('Invalid provider selection.');
        } else {
          toast.error('Invalid request. Please check your input.');
        }
      } else if (status === 401) {
        // Will be handled by interceptor
      } else {
        toast.error('Upload failed. Please try again.');
      }
    },
  });
}
