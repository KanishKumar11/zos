// Layout for unauthenticated screens (login, forgot, reset, accept-invite).
// force-dynamic prevents Next.js from statically pre-rendering auth pages at build time.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
