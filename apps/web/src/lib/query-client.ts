// Singleton React Query client factory — sane defaults for an authed dashboard.
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (count, error) => {
          const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return count < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
