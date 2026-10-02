// Sidebar nav config — items are filtered by user role on render.
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck2,
  ClipboardList,
  FileText,
  GanttChart,
  Handshake,
  Home,
  Landmark,
  Megaphone,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Role } from '@agency/shared';

import { FEATURES, type FeatureKey } from '@/lib/features';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  allow: readonly Role[];
  /** Hidden when this feature flag is off. */
  feature?: FeatureKey;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Items visible to a role, honouring feature flags. */
export function navForRole(role: Role | undefined): NavSection[] {
  if (!role) return [];
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((i) => i.allow.includes(role) && (!i.feature || FEATURES[i.feature])),
  })).filter((s) => s.items.length > 0);
}

/** Best nav label for a path — the top bar falls back to this when a page sets no title. */
export function navLabelFor(pathname: string): string | undefined {
  let best: NavItem | undefined;
  for (const section of NAV) {
    for (const item of section.items) {
      if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && item.href.length > (best?.href.length ?? 0)) {
        best = item;
      }
    }
  }
  return best?.label;
}

const EVERYONE = [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] as const;
const STAFF_NOT_OWNER = [Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] as const;

export const NAV: readonly NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home, allow: EVERYONE },
      { label: 'My tasks', href: '/tasks', icon: ClipboardList, allow: EVERYONE },
      { label: 'Projects', href: '/projects', icon: GanttChart, allow: EVERYONE },
      { label: 'Time', href: '/time', icon: Timer, allow: EVERYONE, feature: 'time' },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, allow: EVERYONE },
      { label: 'Notifications', href: '/notifications', icon: Bell, allow: EVERYONE },
    ],
  },
  {
    label: 'Me',
    items: [{ label: 'My earnings', href: '/earnings', icon: Wallet, allow: STAFF_NOT_OWNER }],
  },
  {
    label: 'People',
    items: [
      { label: 'Team', href: '/team', icon: Users, allow: [Role.OWNER, Role.ADMIN, Role.LEAD] },
      { label: 'Attendance', href: '/attendance', icon: CalendarCheck2, allow: EVERYONE },
      { label: 'Leaves', href: '/leaves', icon: FileText, allow: EVERYONE, feature: 'leaves' },
      { label: 'Payroll', href: '/payroll', icon: Landmark, allow: [Role.OWNER, Role.ADMIN] },
    ],
  },
  {
    label: 'Clients',
    items: [
      { label: 'Clients', href: '/clients', icon: Building2, allow: [Role.OWNER] },
      { label: 'Pipeline', href: '/crm', icon: BarChart3, allow: [Role.OWNER] },
      { label: 'Contracts', href: '/contracts', icon: Handshake, allow: [Role.OWNER] },
      { label: 'Statements of work', href: '/sows', icon: Briefcase, allow: [Role.OWNER] },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Payments out', href: '/payments', icon: Send, allow: [Role.OWNER] },
      { label: 'Invoices', href: '/invoices', icon: Receipt, allow: [Role.OWNER] },
      { label: 'Expenses', href: '/expenses', icon: TrendingDown, allow: [Role.OWNER] },
      { label: 'Other income', href: '/income', icon: TrendingUp, allow: [Role.OWNER] },
      { label: 'Freelancers', href: '/freelancers', icon: UserCheck, allow: [Role.OWNER] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, allow: [Role.OWNER, Role.ADMIN] },
      { label: 'Audit log', href: '/audit', icon: ShieldCheck, allow: [Role.OWNER, Role.ADMIN] },
    ],
  },
];
