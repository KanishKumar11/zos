'use client';

import { Bell, LogOut, Menu, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandLogo, BrandMark } from '@/components/layout/brand';
import { ConfirmHost } from '@/components/ui/confirm-dialog';
import { PageSkeleton } from '@/components/ui/states';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLogout, useMe } from '@/features/auth/auth.hooks';
import { useUnreadCount } from '@/features/notifications/notifications.hooks';
import { usePortalMe } from '@/features/portal/portal.hooks';

const NAV = [
  { href: '/portal', label: 'Overview', exact: true },
  { href: '/portal/projects', label: 'Projects' },
  { href: '/portal/invoices', label: 'Invoices' },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();
  const portal = usePortalMe();
  const logout = useLogout();
  const unread = useUnreadCount();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);
  useEffect(() => {
    // Staff who land here go back to their workspace.
    if (user && user.role !== Role.CLIENT) router.replace('/dashboard');
  }, [user, router]);
  useEffect(() => setMenuOpen(false), [pathname]);

  if (!user && me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const count = unread.data?.count ?? 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
            <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
              <BrandMark />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{portal.data?.client.name ?? 'Client portal'}</span>
                <span className="text-[11px] text-muted-foreground">with Zlaark</span>
              </span>
            </Link>
            <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Portal">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href, n.exact) ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                    active(n.href, n.exact) ? 'bg-foreground font-medium text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <Link href="/portal/notifications" className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Notifications${count ? `, ${count} unread` : ''}`}>
                <Bell className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Account menu" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                    {user ? initials(user.name) : '?'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-[13px] font-medium">{user?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/portal/account">
                      <UserRound className="mr-2 h-3.5 w-3.5" /> Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => logout.mutate()}>
                    <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" className="rounded-md p-2 text-muted-foreground md:hidden" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="border-t px-4 py-2 md:hidden">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className={cn('block rounded-md px-3 py-2 text-sm', active(n.href, n.exact) ? 'bg-brand-wash font-medium text-brand-ink' : 'text-muted-foreground')}>
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
        <footer className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-8 text-xs text-muted-foreground md:px-6">
          <BrandLogo className="h-3.5 opacity-70" />
          <span>· Your project workspace</span>
        </footer>
      </div>
      <ConfirmHost />
    </TooltipProvider>
  );
}
