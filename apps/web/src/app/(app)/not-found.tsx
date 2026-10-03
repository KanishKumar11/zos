import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <div className="rounded-[var(--radius)] border bg-card">
      <EmptyState
        illustration="inbox"
        title="We couldn't find that page"
        description="It may have been moved or deleted, or the link is wrong."
        action={
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
