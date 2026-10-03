// Sidebar — the ink rail: collapsible desktop navigation (md and up). Mobile uses MobileNav.
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
        'sticky top-0 hidden h-screen shrink-0 flex-col bg-rail text-rail-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-[64px]' : 'w-[236px]',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-2.5 px-3.5', collapsed && 'justify-center px-0')}>
        <Brand tone="rail" compact={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-2">
        <NavList collapsed={collapsed} tone="rail" />
      </nav>
      <div className={cn('shrink-0 border-t border-rail-foreground/10 p-2.5', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-rail-foreground/55 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
