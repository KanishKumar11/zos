// Sidebar — collapsible primary navigation. Filters items by current user role.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

import { NAV } from './nav-config';

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const role = useAuthStore((s) => s.user?.role);

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r bg-card transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Brand header */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
          Z
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold tracking-tight text-foreground">ZOS</span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          {collapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3">
        <div className="space-y-4">
          {NAV.map((section) => {
            const visible = section.items.filter((i) => role && i.allow.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={section.label}>
                {!collapsed && (
                  <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visible.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href} className="relative">
                        {active && (
                          <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary" />
                        )}
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                            active
                              ? 'bg-primary/[0.08] font-medium text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
