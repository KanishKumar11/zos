// Sidebar — the ink rail: brand, a quick "Log payment" for the owner, role-filtered navigation and
// the signed-in person at the bottom. Collapsible on desktop (md and up); mobile uses MobileNav.
'use client';

import { PanelLeftClose, PanelLeftOpen, Send } from 'lucide-react';
import Link from 'next/link';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';
import { useUiStore } from '@/store/ui.store';

import { Tooltip } from '@/components/ui/tooltip';
import { Avatar } from '@/components/viz/identity';

import { Brand } from './brand';
import { NavList } from './nav-list';

const ROLE_WORD: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  LEAD: 'Lead',
  MEMBER: 'Team member',
  INTERN: 'Intern',
  CLIENT: 'Client',
};

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const isOwner = user?.role === Role.OWNER;

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-rail-foreground/[0.07] bg-rail text-rail-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-[64px]' : 'w-[240px]',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-2.5 px-3.5', collapsed && 'justify-center px-0')}>
        <Brand tone="rail" compact={collapsed} />
      </div>

      {isOwner && (
        <div className={cn('px-2.5 pb-2', collapsed && 'flex justify-center')}>
          <Tooltip content="Log payment" side="right" disabled={!collapsed}>
            <button
              type="button"
              onClick={() => openLogPayment()}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg bg-brand text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand/90',
                collapsed ? 'h-9 w-9' : 'h-9 w-full',
              )}
              aria-label="Log payment"
            >
              <Send className="h-4 w-4" />
              {!collapsed && 'Log payment'}
            </button>
          </Tooltip>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-2">
        <NavList collapsed={collapsed} tone="rail" />
      </nav>

      <div className="shrink-0 space-y-1 border-t border-rail-foreground/10 p-2.5">
        {user && (
          <Tooltip content={user.name} side="right" disabled={!collapsed}>
            <Link
              href="/profile"
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-rail-foreground/[0.07]',
                collapsed && 'justify-center px-0',
              )}
            >
              <Avatar id={user.id} name={user.name} size="sm" />
              {!collapsed && (
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-medium">{user.name}</span>
                  <span className="block truncate text-[11px] text-rail-foreground/50">{ROLE_WORD[user.role]}</span>
                </span>
              )}
            </Link>
          </Tooltip>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-rail-foreground/55 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
