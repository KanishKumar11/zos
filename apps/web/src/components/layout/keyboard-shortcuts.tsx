// Keyboard shortcuts — "g then d" style jumps, "n" for new, "/" to search, "l" to log a payment,
// "?" for the cheat sheet. Jumps only go to pages the viewer's role can open. Ignored while typing.
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Role } from '@agency/shared';

import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { navForRole } from './nav-config';

const JUMPS: { key: string; href: string; label: string }[] = [
  { key: 'd', href: '/dashboard', label: 'Dashboard' },
  { key: 't', href: '/tasks', label: 'My tasks' },
  { key: 'p', href: '/projects', label: 'Projects' },
  { key: 'c', href: '/clients', label: 'Clients' },
  { key: 'i', href: '/invoices', label: 'Invoices' },
  { key: 'y', href: '/payments', label: 'Payments out' },
  { key: 'f', href: '/freelancers', label: 'Freelancers' },
  { key: 'm', href: '/team', label: 'Team' },
  { key: 'e', href: '/earnings', label: 'My earnings' },
  { key: 'n', href: '/notifications', label: 'Notifications' },
];

/** List pages that open their create form on `?new=1`. */
const NEW_PAGES = ['/projects', '/invoices', '/expenses', '/income', '/clients', '/team', '/freelancers', '/contracts', '/crm'];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable || !!el.closest('[role="dialog"]');
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-figures text-[11px]">{children}</kbd>;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const setPaletteOpen = useQuickActions((s) => s.setPaletteOpen);
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const [help, setHelp] = useState(false);

  const allowed = useMemo(() => {
    const hrefs = new Set(navForRole(role).flatMap((s) => s.items.map((i) => i.href)));
    return JUMPS.filter((j) => hrefs.has(j.href));
  }, [role]);

  const newHere = NEW_PAGES.find((p) => pathname === p);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key;
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        const jump = allowed.find((j) => j.key === key.toLowerCase());
        if (jump) {
          e.preventDefault();
          router.push(jump.href);
        }
        return;
      }
      if (key === 'g') {
        pendingG = Date.now();
        return;
      }
      if (key === '?') {
        e.preventDefault();
        setHelp(true);
      } else if (key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === 'n' && newHere) {
        e.preventDefault();
        router.push(`${newHere}?new=1`);
      } else if (key === 'l' && role === Role.OWNER) {
        e.preventDefault();
        openLogPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed, newHere, role, router, setPaletteOpen, openLogPayment]);

  const general: [string[], string][] = [
    [['Ctrl', 'K'], 'Search everything'],
    [['/'], 'Search'],
    [['n'], 'New item on this list page'],
    ...(role === Role.OWNER ? ([[['l'], 'Log a payment']] as [string[], string][]) : []),
    [['?'], 'Show these shortcuts'],
  ];

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Go to</h3>
            <ul className="space-y-1.5 text-sm">
              {allowed.map((j) => (
                <li key={j.key} className="flex items-center justify-between gap-3">
                  <span>{j.label}</span>
                  <span className="flex gap-1">
                    <Kbd>g</Kbd>
                    <Kbd>{j.key}</Kbd>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Anywhere</h3>
            <ul className="space-y-1.5 text-sm">
              {general.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className="flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
