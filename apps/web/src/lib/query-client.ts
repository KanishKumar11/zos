// Singleton React Query client factory — sane defaults for an authed dashboard.
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiRequestError, getErrorMessage } from './api-client';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    // Mutations without their own onError still tell the user what went wrong.
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.options.onError) return;
        toast.error(getErrorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (count, error) => {
          const status = error instanceof ApiRequestError ? error.status : undefined;
          if (status && status >= 400 && status < 500) return false;
          return count < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
