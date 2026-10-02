// [SHARED] Lifecycle status of a team member.
export enum UserStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  PROBATION = 'PROBATION',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  EXITED = 'EXITED',
}

/** Statuses that may sign in and keep a session. Everyone else is locked out on next refresh. */
export const SIGN_IN_STATUSES: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.PROBATION,
  UserStatus.ON_LEAVE,
] as const;

export const canSignIn = (status: UserStatus): boolean => SIGN_IN_STATUSES.includes(status);
