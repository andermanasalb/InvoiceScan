'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';
import type { AssignmentTree } from '@invoice-flow/shared';
import type { AdminUser, AdminRole } from '@/types/admin';
import type { AxiosError } from 'axios';
import type { ApiError } from '@invoice-flow/shared';

export function useAdminUsers(role?: AdminRole) {
  return useQuery<AdminUser[]>({
    queryKey: ['admin-users', role ?? 'all'],
    queryFn: async () => {
      const res = await adminApi.listUsers(role);
      return res.data as AdminUser[];
    },
  });
}

export function useAssignmentTree() {
  return useQuery<AssignmentTree>({
    queryKey: ['assignment-tree'],
    queryFn: async () => {
      const res = await adminApi.getAssignmentTree();
      return res.data as AssignmentTree;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string; role: string }) =>
      adminApi.createUser(payload),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-tree'] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to create user',
      );
    },
  });
}

export function useAssignUploader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      uploaderId,
      validatorId,
    }: {
      uploaderId: string;
      validatorId: string;
    }) => adminApi.assignUploader(uploaderId, validatorId),
    onSuccess: () => {
      toast.success('Uploader assigned to validator');
      queryClient.invalidateQueries({ queryKey: ['assignment-tree'] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to assign uploader',
      );
    },
  });
}

export function useRemoveUploaderAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uploaderId: string) =>
      adminApi.removeUploaderAssignment(uploaderId),
    onSuccess: () => {
      toast.success('Assignment removed');
      queryClient.invalidateQueries({ queryKey: ['assignment-tree'] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to remove assignment',
      );
    },
  });
}

export function useAssignValidator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      validatorId,
      approverId,
    }: {
      validatorId: string;
      approverId: string;
    }) => adminApi.assignValidator(validatorId, approverId),
    onSuccess: () => {
      toast.success('Validator assigned to approver');
      queryClient.invalidateQueries({ queryKey: ['assignment-tree'] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to assign validator',
      );
    },
  });
}

export function useRemoveValidatorAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (validatorId: string) =>
      adminApi.removeValidatorAssignment(validatorId),
    onSuccess: () => {
      toast.success('Assignment removed');
      queryClient.invalidateQueries({ queryKey: ['assignment-tree'] });
    },
    onError: (error: AxiosError<ApiError>) => {
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to remove assignment',
      );
    },
  });
}
