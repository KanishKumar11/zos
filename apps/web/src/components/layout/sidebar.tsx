// Sidebar — collapsible desktop navigation (md and up). Mobile uses MobileNav.
'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useUiStore } from '@/store/ui.store';

import { Brand } from './brand';
import { NavList } from './nav-list';

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex',
        collapsed ? 'w-[60px]' : 'w-[232px]',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b px-3', collapsed && 'justify-center')}>
        {!collapsed && <Brand />}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            !collapsed && 'ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3">
        <NavList collapsed={collapsed} />
      </nav>
    </aside>
  );
}
