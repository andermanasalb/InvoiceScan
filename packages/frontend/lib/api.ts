/**
 * @file Axios instance and API helpers.
 *
 * Centralises all HTTP calls to the backend, including:
 *   - silent JWT refresh via response interceptors
 *   - rate-limit toast notifications
 *   - typed `authApi` and `invoiceApi` namespaces
 *
 * The access token is kept in-memory only (never in localStorage) and injected
 * into every request via the request interceptor.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage (in-memory only - NOT localStorage)
let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Subscribe to token refresh
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Notify all subscribers with new token
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// Request interceptor - inject Authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and 429
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 429 - Rate limit
    if (error.response?.status === 429) {
      toast.error('Too many attempts, wait 60 seconds');
      return Promise.reject(error);
    }

    // Handle 401 - Unauthorized
    // Skip silent refresh for auth endpoints — a 401 there means bad credentials
    // or no refresh token, not an expired access token. Retrying would deadlock.
    const requestUrl = originalRequest.url ?? '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent token refresh
        const response = await api.post('/auth/refresh');
        const newToken = response.data.data.accessToken;

        setAccessToken(newToken);
        onTokenRefreshed(newToken);
        isRefreshing = false;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear auth and redirect to login
        isRefreshing = false;
        setAccessToken(null);

        // Only redirect if we're in the browser and not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API functions
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    setAccessToken(null);
  },
};

// Invoice API functions
export const invoiceApi = {
  list: async (params: { status?: string; page?: number; limit?: number; sort?: string }) => {
    const response = await api.get('/invoices', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  getEvents: async (id: string) => {
    const response = await api.get(`/invoices/${id}/events`);
    return response.data;
  },

  approve: async (id: string) => {
    const response = await api.patch(`/invoices/${id}/approve`);
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await api.patch(`/invoices/${id}/reject`, { reason });
    return response.data;
  },

  sendToApproval: async (id: string) => {
    const response = await api.patch(`/invoices/${id}/send-to-approval`);
    return response.data;
  },

  sendToValidation: async (id: string) => {
    const response = await api.patch(`/invoices/${id}/send-to-validation`);
    return response.data;
  },

  retry: async (id: string) => {
    const response = await api.patch(`/invoices/${id}/retry`);
    return response.data;
  },

  getNotes: async (id: string) => {
    const response = await api.get(`/invoices/${id}/notes`);
    return response.data;
  },

  addNote: async (id: string, content: string) => {
    const response = await api.post(`/invoices/${id}/notes`, { content });
    return response.data;
  },

  upload: async (file: File, providerId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('providerId', providerId);

    const response = await api.post('/invoices/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  stats: async (): Promise<{ data: Record<string, number> }> => {
    const response = await api.get('/invoices/stats');
    return response.data;
  },

  /** Fetches the original PDF as a Blob (auth handled by interceptor). */
  getFile: async (id: string): Promise<Blob> => {
    const response = await api.get(`/invoices/${id}/file`, { responseType: 'blob' });
    return response.data as Blob;
  },

  /**
   * POST /invoices/export
   * Enqueues an async export job. Returns { jobId }.
   */
  export: async (params: {
    format: 'csv' | 'json';
    status?: string;
    sort?: string;
  }): Promise<{ data: { jobId: string } }> => {
    const response = await api.post('/invoices/export', null, { params });
    return response.data as { data: { jobId: string } };
  },

  /**
   * GET /exports/:jobId/status
   * Polls the export job. Returns status + downloadUrl when done.
   */
  getExportStatus: async (jobId: string): Promise<{
    data: {
      status: 'pending' | 'processing' | 'done' | 'failed';
      progress: number;
      downloadUrl: string | null;
      format: string | null;
    };
  }> => {
    const response = await api.get(`/exports/${jobId}/status`);
    return response.data as {
      data: {
        status: 'pending' | 'processing' | 'done' | 'failed';
        progress: number;
        downloadUrl: string | null;
        format: string | null;
      };
    };
  },
};

// Admin API functions (admin role only)
export const adminApi = {
  listUsers: async (role?: string) => {
    const response = await api.get('/admin/users', { params: role ? { role } : {} });
    return response.data;
  },

  createUser: async (payload: { email: string; password: string; role: string }) => {
    const response = await api.post('/admin/users', payload);
    return response.data;
  },

  deleteUser: async (userId: string) => {
    await api.delete(`/admin/users/${userId}`);
  },

  getAssignmentTree: async () => {
    const response = await api.get('/admin/assignments/tree');
    return response.data;
  },

  assignUploader: async (uploaderId: string, validatorId: string) => {
    const response = await api.post('/admin/assignments/uploaders', { uploaderId, validatorId });
    return response.data;
  },

  removeUploaderAssignment: async (uploaderId: string) => {
    const response = await api.delete(`/admin/assignments/uploaders/${uploaderId}`);
    return response.data;
  },

  assignValidator: async (validatorId: string, approverId: string) => {
    const response = await api.post('/admin/assignments/validators', { validatorId, approverId });
    return response.data;
  },

  removeValidatorAssignment: async (validatorId: string) => {
    const response = await api.delete(`/admin/assignments/validators/${validatorId}`);
    return response.data;
  },
};
