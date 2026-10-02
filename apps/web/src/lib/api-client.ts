// Axios instance configured with credentials, response unwrap, 401 refresh, and toast on error.
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import type { ApiError, ApiResponse, PaginationMeta } from '@agency/shared';

import { env } from './env';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Every failed API call surfaces as this Error subclass, so `err.message` is always a readable
 * sentence (hooks toast it directly) and `err.status` / `err.code` / `err.fieldErrors` are typed.
 * `error` mirrors the server envelope for older callers that read `err.error.message`.
 */
export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details?: unknown;
  readonly fieldErrors: Record<string, string[]>;
  readonly error: ApiError['error'];

  constructor(envelope: ApiError['error'], status?: number) {
    const fieldErrors = extractFieldErrors(envelope.details);
    super(describe(envelope, fieldErrors, status));
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
    this.fieldErrors = fieldErrors;
    this.error = { ...envelope, message: this.message };
  }
}

const humanize = (field: string): string =>
  field
    .replace(/Paise$/, '')
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

function extractFieldErrors(details: unknown): Record<string, string[]> {
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors;
  if (!fe) return {};
  return Object.fromEntries(Object.entries(fe).filter((e): e is [string, string[]] => !!e[1]?.length));
}

function describe(envelope: ApiError['error'], fieldErrors: Record<string, string[]>, status?: number): string {
  const fields = Object.entries(fieldErrors);
  if (fields.length > 0) {
    return fields
      .slice(0, 3)
      .map(([field, msgs]) => `${humanize(field)}: ${msgs[0]}`)
      .join(' · ');
  }
  if (status === 403 && envelope.message === 'Insufficient role') return "You don't have access to do that.";
  return envelope.message || 'Something went wrong. Please try again.';
}

/** Readable message for any thrown value — use in toasts and error states. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  const envelopeMsg = (err as { error?: { message?: string } } | undefined)?.error?.message;
  return envelopeMsg || fallback;
}

/** Converts axios / envelope failures into ApiRequestError; passes anything else through. */
function toApiError(err: unknown): unknown {
  if (err instanceof ApiRequestError) return err;
  if (err && typeof err === 'object' && 'isAxiosError' in err) {
    const axErr = err as AxiosError<ApiError>;
    const status = axErr.response?.status;
    if (axErr.response?.data?.error) return new ApiRequestError(axErr.response.data.error, status);
    if (!axErr.response) {
      return new ApiRequestError({ code: 'NETWORK_ERROR', message: "Can't reach the server. Check your connection." });
    }
    return new ApiRequestError({ code: 'HTTP_ERROR', message: `Request failed (${status})` }, status);
  }
  if (err && typeof err === 'object' && (err as ApiError).success === false && (err as ApiError).error) {
    return new ApiRequestError((err as ApiError).error);
  }
  return err;
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
    throw toApiError(err);
  }
}

/** Unwrap ApiResponse into either data (success) or throw with the error envelope. */
export async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await p;
    if (res.data.success) return res.data.data;
    throw res.data;
  } catch (err) {
    throw toApiError(err);
  }
}
