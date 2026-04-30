// Layout for unauthenticated screens (login, forgot, reset, accept-invite).
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
