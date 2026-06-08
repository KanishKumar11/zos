// Axios instance configured with credentials, response unwrap, 401 refresh, and toast on error.
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import type { ApiError, ApiResponse, PaginationMeta } from '@agency/shared';

import { env } from './env';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<void> | null = null;

async function refresh(client: AxiosInstance): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = client
      .post('/auth/refresh', undefined, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20_000,
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetryConfig | undefined;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !config.url?.includes('/auth/')
    ) {
      config._retry = true;
      try {
        await refresh(api);
        return api(config);
      } catch {
        // fall through; caller surfaces
      }
    }
    return Promise.reject(error);
  },
);

/** Unwrap a paginated ApiResponse into { items, meta }. */
export async function unwrapPaginated<T>(
  p: Promise<{ data: ApiResponse<T[]> }>,
): Promise<{ items: T[]; meta: PaginationMeta }> {
  try {
    const res = await p;
    if (res.data.success) {
      return {
        items: res.data.data,
        meta: res.data.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    }
    throw res.data;
  } catch (err) {
    if (err && typeof err === 'object' && 'isAxiosError' in err) {
      const axErr = err as AxiosError<ApiError>;
      if (axErr.response?.data?.error) throw axErr.response.data;
    }
    throw err;
  }
}

/** Unwrap ApiResponse into either data (success) or throw with the error envelope. */
export async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await p;
    if (res.data.success) return res.data.data;
    throw res.data;
  } catch (err) {
    if (err && typeof err === 'object' && 'isAxiosError' in err) {
      const axErr = err as AxiosError<ApiError>;
      if (axErr.response?.data?.error) throw axErr.response.data;
    }
    throw err;
  }
}
