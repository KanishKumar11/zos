// Quick "create" actions shared by the "+ New" menu and the ⌘K palette. List pages open their
// create dialog when the URL carries ?new=1 (see useNewParam).
'use client';

import { Building2, FolderPlus, Receipt, Send, TrendingDown, UserPlus, type LucideIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Role } from '@agency/shared';

import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  allow: readonly Role[];
  href?: string;
  run?: () => void;
  keywords?: string;
}

export function useNewActions(): QuickAction[] {
  const role = useAuthStore((s) => s.user?.role);
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const all: QuickAction[] = [
    { id: 'log-payment', label: 'Log payment', icon: Send, allow: [Role.OWNER], run: () => openLogPayment(), keywords: 'pay payout freelancer member' },
    { id: 'new-invoice', label: 'New invoice', icon: Receipt, allow: [Role.OWNER], href: '/invoices?new=1', keywords: 'bill client' },
    { id: 'new-project', label: 'New project', icon: FolderPlus, allow: [Role.OWNER, Role.ADMIN, Role.LEAD], href: '/projects?new=1' },
    { id: 'new-client', label: 'New client', icon: Building2, allow: [Role.OWNER], href: '/clients?new=1' },
    { id: 'new-expense', label: 'New expense', icon: TrendingDown, allow: [Role.OWNER], href: '/expenses?new=1', keywords: 'spend bill' },
    { id: 'invite', label: 'Invite team member', icon: UserPlus, allow: [Role.OWNER, Role.ADMIN], href: '/team?new=1' },
  ];
  return role ? all.filter((a) => a.allow.includes(role)) : [];
}

/**
 * Opens a page's create dialog when the URL has ?new=1, then removes the flag so a refresh
 * doesn't reopen it.  useNewParam(() => setCreateOpen(true))
 */
export function useNewParam(open: () => void): void {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flag = params.get('new');
  useEffect(() => {
    if (flag !== '1') return;
    open();
    const next = new URLSearchParams(params.toString());
    next.delete('new');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
}
