// [SHARED] User role enum — drives all RBAC checks across web + api.
export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  LEAD = 'LEAD',
  MEMBER = 'MEMBER',
  INTERN = 'INTERN',
  /** External client-company user — portal only, denied everywhere else by ClientDenyGuard. */
  CLIENT = 'CLIENT',
}

export const ALL_ROLES: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.LEAD,
  Role.MEMBER,
  Role.INTERN,
] as const;

/** Internal team roles (everyone except portal clients). Use for staff pickers and invites. */
export const STAFF_ROLES: readonly Role[] = ALL_ROLES;

export const isStaffRole = (role: Role): boolean => role !== Role.CLIENT;

export const FINANCIAL_ROLES: readonly Role[] = [Role.OWNER] as const;
