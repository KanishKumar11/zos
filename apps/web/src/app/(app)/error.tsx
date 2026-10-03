'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/states';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="rounded-[var(--radius)] border bg-card">
      <ErrorState title="Something went wrong on this page" error={error} onRetry={reset} />
    </div>
  );
}
