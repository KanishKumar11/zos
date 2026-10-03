// Shown when a page isn't available for the signed-in role.
import { ShieldOff } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <BrandMark className="h-10 w-10" />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-wash">
        <ShieldOff className="h-5 w-5 text-brand-ink" />
      </div>
      <h1 className="font-display max-w-[20ch] text-3xl font-bold leading-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        It&apos;s limited to other roles. If you think you should see it, ask your workspace owner.
      </p>
      <Button asChild className="mt-1">
        <Link href="/">Go to my home page</Link>
      </Button>
    </div>
  );
}
