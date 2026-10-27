// FloatingDock — modern floating island navigation replacing the static sidebar.
// Glassmorphic capsule fixed at bottom-center with smooth category flyouts,
// quick actions, and minimize capabilities.
'use client';

import {
  Bell,
  Building2,
  ChevronUp,
  FolderKanban,
  Home,
  Maximize2,
  Minimize2,
  Search,
  Send,
  SlidersHorizontal,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';
import { useUnreadCount } from '@/features/notifications/notifications.hooks';

import { BrandMark } from '@/components/layout/brand';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';

import { navForRole, type NavItem } from './nav-config';

interface HubDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  sectionNames: string[];
}

const HUBS: HubDefinition[] = [
  { id: 'work', label: 'Work', icon: FolderKanban, sectionNames: ['Workspace'] },
  { id: 'people', label: 'People', icon: Users, sectionNames: ['People'] },
  { id: 'clients', label: 'Clients', icon: Building2, sectionNames: ['Clients'] },
  { id: 'money', label: 'Finances', icon: Wallet, sectionNames: ['Money', 'Me'] },
  { id: 'admin', label: 'Admin', icon: SlidersHorizontal, sectionNames: ['Admin'] },
];

export function FloatingDock() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const setPaletteOpen = useQuickActions((s) => s.setPaletteOpen);
  const unread = useUnreadCount().data?.count ?? 0;
  const isOwner = role === Role.OWNER;
  const [minimized, setMinimized] = useState(false);

  // Filter navigation sections based on current user role
  const sections = navForRole(role);

  // Group nav items into the designated hubs
  const hubItemsMap = new Map<string, NavItem[]>();
  for (const hub of HUBS) {
    const items = sections
      .filter((s) => hub.sectionNames.includes(s.label))
      .flatMap((s) => s.items)
      // Exclude dashboard and notifications from 'Work' hub since they have dedicated dock buttons
      .filter((i) => i.href !== '/dashboard' && i.href !== '/notifications');
    if (items.length > 0) {
      hubItemsMap.set(hub.id, items);
    }
  }

  const isDashboardActive = pathname === '/dashboard';

  if (minimized) {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-2 text-xs font-medium shadow-2xl backdrop-blur-xl transition-all hover:border-primary/50 hover:bg-card hover:scale-105 active:scale-95"
          aria-label="Expand navigation dock"
        >
          <BrandMark className="h-4 w-4" />
          <span className="font-semibold text-foreground">Menu</span>
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          {unread > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    );
  }

  return (
    <nav
      aria-label="Floating navigation dock"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-border/80 bg-card/90 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl ring-1 ring-white/10 dark:ring-white/5">
        {/* Direct Link: Dashboard */}
        <Tooltip content="Dashboard (g then d)" side="top">
          <Link
            href="/dashboard"
            aria-current={isDashboardActive ? 'page' : undefined}
            className={cn(
              'relative flex h-10 w-10 sm:h-10 sm:w-auto sm:px-3 items-center justify-center gap-2 rounded-full text-xs font-medium transition-all duration-150 active:scale-95',
              isDashboardActive
                ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/25'
                : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Dashboard</span>
          </Link>
        </Tooltip>

        {/* Dynamic Category Hubs */}
        {HUBS.map((hub) => {
          const items = hubItemsMap.get(hub.id);
          if (!items || items.length === 0) return null;

          const Icon = hub.icon;
          const isHubActive = items.some(
            (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
          );

          return (
            <DropdownMenu key={hub.id}>
              <Tooltip content={hub.label} side="top">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${hub.label} navigation`}
                    className={cn(
                      'relative flex h-10 w-10 sm:h-10 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95',
                      isHubActive
                        ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{hub.label}</span>
                    <ChevronUp className="hidden sm:inline h-3 w-3 opacity-50" />
                    {isHubActive && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>

              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={14}
                className="w-56 rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {hub.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {items.map((item) => {
                  const ItemIcon = item.icon;
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors',
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <ItemIcon
                          className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}

        {/* Separator */}
        <div className="h-5 w-px bg-border/80 mx-0.5" />

        {/* Quick Search */}
        <Tooltip content="Quick Search (Ctrl K)" side="top">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/80 hover:text-foreground transition-all active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
        </Tooltip>

        {/* Quick Payment Action for Owner */}
        {isOwner && (
          <Tooltip content="Log payment (l)" side="top">
            <button
              type="button"
              onClick={() => openLogPayment()}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
              aria-label="Log payment"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pay</span>
            </button>
          </Tooltip>
        )}

        {/* Notifications Quick Jump */}
        <Tooltip content={`Notifications (${unread} unread)`} side="top">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/80 hover:text-foreground transition-all active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </Link>
        </Tooltip>

        {/* Minimize Button */}
        <Tooltip content="Minimize dock" side="top">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize dock"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-all"
          >
            <Minimize2 className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
