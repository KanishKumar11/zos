// Lightweight server-side route → role map used by middleware.ts to gate financial routes.
import { Role } from '@agency/shared';

interface RouteRule {
  prefix: string;
  allow: readonly Role[];
}

// Most specific prefix first — ruleForPath returns the first match.
export const ROUTE_RULES: readonly RouteRule[] = [
  // Pay is owner-only (plus each person's own, under /earnings).
  { prefix: '/payroll/payslips', allow: [Role.LEAD, Role.MEMBER, Role.INTERN, Role.OWNER, Role.ADMIN] },
  { prefix: '/payroll', allow: [Role.OWNER] },
  { prefix: '/clients', allow: [Role.OWNER] },
  { prefix: '/crm', allow: [Role.OWNER] },
  { prefix: '/invoices', allow: [Role.OWNER] },
  { prefix: '/contracts', allow: [Role.OWNER] },
  { prefix: '/sows', allow: [Role.OWNER] },
  { prefix: '/expenses', allow: [Role.OWNER] },
  { prefix: '/income', allow: [Role.OWNER] },
  { prefix: '/freelancer-payments', allow: [Role.OWNER] },
  { prefix: '/freelancers', allow: [Role.OWNER] },
  { prefix: '/payments', allow: [Role.OWNER] },
  { prefix: '/portal-preview', allow: [Role.OWNER] },
  { prefix: '/earnings', allow: [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN] },
  { prefix: '/audit', allow: [Role.OWNER, Role.ADMIN] },
  { prefix: '/dashboard/owner', allow: [Role.OWNER] },
  { prefix: '/team/internship-letter', allow: [Role.OWNER] },
  { prefix: '/team', allow: [Role.OWNER, Role.ADMIN, Role.LEAD] },
  { prefix: '/settings', allow: [Role.OWNER, Role.ADMIN] },
];

/** Where each role lands after sign-in (and when it hits a page outside its area). */
export const homeForRole = (role: Role | string | null | undefined): string =>
  role === Role.CLIENT ? '/portal' : '/dashboard';

/** Portal users live under /portal; staff never do. */
export const isPortalPath = (pathname: string): boolean =>
  pathname === '/portal' || pathname.startsWith('/portal/');

/** Paths matched by pattern rather than prefix (checked first). */
const PATTERN_RULES: readonly { test: RegExp; allow: readonly Role[] }[] = [
  { test: /^\/team\/[^/]+\/compensation(\/|$)/, allow: [Role.OWNER] },
];

export function ruleForPath(pathname: string): RouteRule | undefined {
  const pattern = PATTERN_RULES.find((r) => r.test.test(pathname));
  if (pattern) return { prefix: pathname, allow: pattern.allow };
  return ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
}
