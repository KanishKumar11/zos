'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useMe } from '@/features/auth/auth.hooks';
import { useAuthStore } from '@/store/auth.store';

import { CommandPalette } from '@/components/layout/command-palette';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ConfirmHost } from '@/components/ui/confirm-dialog';
import { PageSkeleton } from '@/components/ui/states';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LogPaymentSheet } from '@/features/payouts/log-payment-sheet';

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (!user && me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
            <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
          </main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
      <LogPaymentSheet />
      <ConfirmHost />
    </TooltipProvider>
  );
}
