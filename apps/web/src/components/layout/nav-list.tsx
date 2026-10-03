// NavList — the role-filtered navigation, shared by the desktop sidebar and the mobile drawer.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

import { Tooltip } from '@/components/ui/tooltip';

import { navForRole } from './nav-config';

export function NavList({
  collapsed = false,
  onNavigate,
  tone = 'paper',
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** `rail` = on the dark ink rail. */
  tone?: 'rail' | 'paper';
}) {
  const rail = tone === 'rail';
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
            <p
              className={cn(
                'mb-1.5 px-2.5 font-figures text-[10px] font-medium uppercase tracking-[0.14em]',
                rail ? 'text-rail-foreground/40' : 'text-muted-foreground/70',
              )}
            >
              {section.label}
            </p>
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
                        'relative flex items-center gap-3 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors',
                        collapsed && 'justify-center px-0',
                        rail
                          ? active
                            ? 'bg-rail-foreground/[0.09] font-medium text-rail-foreground before:absolute before:-left-2.5 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-brand'
                            : 'text-rail-foreground/60 hover:bg-rail-foreground/[0.06] hover:text-rail-foreground'
                          : active
                            ? 'bg-brand-wash font-medium text-brand-ink'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', rail && active && 'text-brand')} />
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
