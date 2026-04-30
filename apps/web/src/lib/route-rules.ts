// Lightweight server-side route → role map used by middleware.ts to gate financial routes.
import { Role } from '@agency/shared';

interface RouteRule {
  prefix: string;
  allow: readonly Role[];
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/clients', allow: [Role.OWNER] },
  { prefix: '/crm', allow: [Role.OWNER] },
  { prefix: '/invoices', allow: [Role.OWNER] },
  { prefix: '/audit', allow: [Role.OWNER] },
  { prefix: '/dashboard/owner', allow: [Role.OWNER] },
  { prefix: '/payroll', allow: [Role.OWNER, Role.ADMIN] },
  { prefix: '/team', allow: [Role.OWNER, Role.ADMIN, Role.LEAD] },
  { prefix: '/settings', allow: [Role.OWNER, Role.ADMIN] },
];

export function ruleForPath(pathname: string): RouteRule | undefined {
  return ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
}
