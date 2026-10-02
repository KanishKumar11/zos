import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <div className="rounded-lg border bg-card">
      <EmptyState
        icon={SearchX}
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
