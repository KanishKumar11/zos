// NavList — the role-filtered navigation, shared by the desktop sidebar and the mobile drawer.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

import { Tooltip } from '@/components/ui/tooltip';

import { navForRole } from './nav-config';

export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const sections = navForRole(role);
  // Longest matching href wins, so /payroll/payslips doesn't also light up /payroll.
  const activeHref = sections
    .flatMap((s) => s.items)
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <p className="mb-1 px-2.5 text-[11px] font-medium text-muted-foreground/70">{section.label}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Tooltip content={item.label} side="right" disabled={!collapsed}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
