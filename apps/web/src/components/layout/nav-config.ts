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
  Megaphone,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Role } from '@agency/shared';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  allow: readonly Role[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: readonly NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'My Tasks', href: '/tasks', icon: ClipboardList, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Time', href: '/time', icon: CalendarCheck2, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Projects', href: '/projects', icon: GanttChart, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Notifications', href: '/notifications', icon: Bell, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Team', href: '/team', icon: Users, allow: [Role.OWNER, Role.ADMIN, Role.LEAD] },
      { label: 'Attendance', href: '/attendance', icon: CalendarCheck2, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Leaves', href: '/leaves', icon: FileText, allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'My Payslips', href: '/payroll/payslips', icon: Wallet, allow: [Role.LEAD, Role.MEMBER, Role.INTERN] },
      { label: 'Payroll', href: '/payroll', icon: Wallet, allow: [Role.OWNER, Role.ADMIN] },
      { label: 'Clients', href: '/clients', icon: Building2, allow: [Role.OWNER] },
      { label: 'Pipeline', href: '/crm', icon: BarChart3, allow: [Role.OWNER] },
      { label: 'Invoices', href: '/invoices', icon: Receipt, allow: [Role.OWNER] },
      { label: 'Contracts', href: '/contracts', icon: Handshake, allow: [Role.OWNER] },
      { label: 'Statements of Work', href: '/sows', icon: Briefcase, allow: [Role.OWNER] },
      { label: 'Expenses', href: '/expenses', icon: TrendingDown, allow: [Role.OWNER] },
      { label: 'Freelancers', href: '/freelancer-payments', icon: UserCheck, allow: [Role.OWNER] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, allow: [Role.OWNER, Role.ADMIN] },
      { label: 'Audit Log', href: '/audit', icon: ShieldCheck, allow: [Role.OWNER, Role.ADMIN] },
    ],
  },
];
