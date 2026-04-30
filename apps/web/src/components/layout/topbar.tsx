// Topbar — user menu, theme toggle, notification bell.
'use client';

import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';

import { initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/auth.hooks';
import { useUnreadCount } from '@/features/notifications/notifications.hooks';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
      <div className="text-sm font-medium">{user?.name ?? '—'}</div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
          <Link href="/notifications" className="relative">
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
                aria-label={`${count} unread`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {user ? initials(user.name) : '?'}
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => logout.mutate()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
