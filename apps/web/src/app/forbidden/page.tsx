// 403 fallback page reached via middleware redirect.
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">403 — Forbidden</h1>
      <p className="text-muted-foreground">You don't have access to this resource.</p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
