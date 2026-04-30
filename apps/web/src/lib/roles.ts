// Role helper utilities used by RoleGate, sidebar, and permission checks.
import { Role, FINANCIAL_ROLES } from '@agency/shared';

export { Role, FINANCIAL_ROLES };
export type RoleType = Role;

export const isOwner = (role?: Role | null): boolean => role === Role.OWNER;
export const isOwnerOrAdmin = (role?: Role | null): boolean =>
  role === Role.OWNER || role === Role.ADMIN;
export const canManagePeople = (role?: Role | null): boolean =>
  role === Role.OWNER || role === Role.ADMIN || role === Role.LEAD;
export const canSeeFinancials = (role?: Role | null): boolean =>
  role !== undefined && role !== null && (FINANCIAL_ROLES as readonly Role[]).includes(role);
