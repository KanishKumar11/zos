// Sidebar — collapsible primary navigation. Filters items by current user role.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

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
        'sticky top-0 flex h-screen flex-col border-r bg-card transition-all',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!collapsed && <span className="text-sm font-semibold">Agency</span>}
        <button
          type="button"
          onClick={toggle}
          className="rounded p-1 hover:bg-accent"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {NAV.map((section) => {
          const visible = section.items.filter((i) => role && i.allow.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </p>
              )}
              <ul className="space-y-1">
                {visible.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-2 py-2 text-sm',
                          active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
