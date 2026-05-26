// Layout for unauthenticated screens (login, forgot, reset, accept-invite).
// force-dynamic prevents Next.js from statically pre-rendering auth pages at build time.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-6">
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
          Z
        </div>
        <span className="text-[17px] font-semibold tracking-tight">ZOS</span>
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
