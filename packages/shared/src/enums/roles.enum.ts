// [SHARED] User role enum — drives all RBAC checks across web + api.
export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  LEAD = 'LEAD',
  MEMBER = 'MEMBER',
  INTERN = 'INTERN',
}

export const ALL_ROLES: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.LEAD,
  Role.MEMBER,
  Role.INTERN,
] as const;

export const FINANCIAL_ROLES: readonly Role[] = [Role.OWNER] as const;
