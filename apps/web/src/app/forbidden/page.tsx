// Shown when a page isn't available for the signed-in role.
import { ShieldOff } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
      <ShieldOff className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        It&apos;s limited to other roles. If you think you should see it, ask your workspace owner.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Go to my home page</Link>
      </Button>
    </div>
  );
}
