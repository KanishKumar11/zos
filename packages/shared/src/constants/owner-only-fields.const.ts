// [SHARED] Field strip lists — used by backend SerializeInterceptor and as a single source of truth
// for which fields must NEVER reach a non-OWNER client. Keys correspond to resource identifiers
// emitted by the controller's @SerializeResource() decorator (or inferred from route).
import { Role } from '../enums/roles.enum';

/** Fields removed from any non-OWNER response on these resources. */
export const OWNER_ONLY_FIELDS: Readonly<Record<string, readonly string[]>> = {
  project: ['clientId', 'clientBudgetPaise', 'agencyMarginPaise', 'currency'],
  user: ['bankDetails'],
  payrollEntry: ['baseSalary', 'bonuses', 'deductions', 'netPay'],
  sow: ['totalValue', 'milestones', 'clientId', 'documentUrl'],
  invoice: ['*'],
  client: ['*'],
};

/** Roles allowed to see financial fields. */
export const FINANCIAL_VISIBLE_ROLES: readonly Role[] = [Role.OWNER] as const;
