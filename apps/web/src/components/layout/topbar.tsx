// Topbar — page context, theme toggle, notification bell, user menu.
'use client';

import { Bell, LogOut, Moon, Sun, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/features/auth/auth.hooks';
import { useUnreadCount } from '@/features/notifications/notifications.hooks';

function usePageTitle() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const last = segments[segments.length - 1];
  if (!last) return 'Dashboard';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  const pageTitle = usePageTitle();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-card/80 px-5 backdrop-blur-sm">
      {/* Page title */}
      <h1 className="text-[13px] font-medium text-foreground/80">{pageTitle}</h1>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Notifications" asChild>
          <Link href="/notifications" className="relative">
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground"
                aria-label={`${count} unread`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="User menu"
            >
              {user ? initials(user.name) : '?'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium leading-none">{user?.name}</span>
                <span className="text-[11px] text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => logout.mutate()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

