// Topbar — breadcrumbs, search (⌘K), "+ New" quick actions, notifications, theme, user menu.
'use client';

import { Bell, ChevronRight, LogOut, Menu, Moon, Plus, Search, Settings, Sun, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Role } from '@agency/shared';

import { initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { usePageMetaStore } from '@/store/page-meta.store';
import { useQuickActions } from '@/store/quick-actions.store';

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

import { navLabelFor } from './nav-config';
import { useNewActions } from './quick-actions';

function Breadcrumbs() {
  const pathname = usePathname();
  const { title, crumbs } = usePageMetaStore();
  const current = title || navLabelFor(pathname) || '';
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
      {crumbs.map((c) => (
        <span key={`${c.label}${c.href}`} className="hidden min-w-0 items-center gap-1 sm:flex">
          {c.href ? (
            <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className="truncate text-muted-foreground">{c.label}</span>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        </span>
      ))}
      <span className="truncate font-medium text-foreground/90">{current}</span>
    </nav>
  );
}

function NewMenu() {
  const actions = useNewActions();
  const router = useRouter();
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8 gap-1 px-2.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <DropdownMenuItem
              key={a.id}
              className="cursor-pointer"
              onClick={() => (a.run ? a.run() : a.href && router.push(a.href))}
            >
              <Icon className="mr-2 h-3.5 w-3.5" />
              {a.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useLogout();
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  const setPaletteOpen = useQuickActions((s) => s.setPaletteOpen);
  const setMobileNavOpen = useQuickActions((s) => s.setMobileNavOpen);
  const canSettings = user?.role === Role.OWNER || user?.role === Role.ADMIN;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:px-8">
      <button
        type="button"
        className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden h-8 items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-4 rounded border bg-muted px-1.5 font-sans text-[10px]">Ctrl K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground sm:hidden"
          aria-label="Search"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>

        <NewMenu />

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} asChild>
          <Link href="/notifications" className="relative">
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="User menu"
            >
              {user ? initials(user.name) : '?'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium leading-none">{user?.name}</span>
                <span className="text-[11px] text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <UserRound className="mr-2 h-3.5 w-3.5" />
                My profile
              </Link>
            </DropdownMenuItem>
            {canSettings && (
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
