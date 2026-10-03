// Audit presenter — the owner sees every entry as written; everyone else (admins) gets a money-free view.
//
// Rule: only the owner (and a client, for their own company, in the portal) ever sees real prices.
// Admins still need "who did what, when" for people work, so non-owner viewers get:
//  • no entries at all for money entities/actions (filtered in the query — see NON_OWNER_EXCLUDE),
//  • every money-looking key removed from before/after snapshots (recursively),
//  • currency figures in the summary text replaced with "an amount".
import { AuditAction, Role } from '@agency/shared';

/** Entities whose whole history is money — never shown to non-owners. */
export const MONEY_ENTITIES = [
  'payout',
  'payroll',
  'compensation',
  'invoice',
  'expense',
  'income',
  'contract',
  'sow',
  'opportunity',
  'freelancer',
  'client',
] as const;

/** Actions on otherwise-visible entities (e.g. project) that are purely about money. */
export const MONEY_ACTIONS: AuditAction[] = [
  AuditAction.MEMBER_FEE_SET,
  AuditAction.FREELANCER_ENGAGED,
  AuditAction.PAYMENT_LOGGED,
  AuditAction.PAYMENT_UPDATED,
  AuditAction.PAYMENT_DELETED,
  AuditAction.PAYOUTS_IMPORTED,
  AuditAction.COMPENSATION_UPDATED,
  AuditAction.BANK_DETAILS_UPDATED,
  AuditAction.PAYROLL_RUN_CONFIRMED,
  AuditAction.PAYROLL_RUN_PAID,
];

/** Mongo filter fragment excluding money entries for non-owner viewers. */
export function nonOwnerExclusion(): Record<string, unknown> {
  return {
    $nor: [
      { entity: new RegExp(`^(${MONEY_ENTITIES.join('|')})$`, 'i') },
      { action: { $in: MONEY_ACTIONS } },
    ],
  };
}

const MONEY_KEY = /paise|amount|budget|margin|salary|ctc|hra|gst|total|price|fee|value|balance|bank|account|ifsc|upi|pay(ment|out|slip)?s?$|allowance|deduction|bonus|net|gross/i;
const CURRENCY_FIGURE = /(₹|Rs\.?|INR|\$|€|£)\s?-?[\d,]+(\.\d+)?(\s?(k|K|L|lakh|cr|crore|M))?/g;

/** Deep copy without any money-looking keys. Arrays and nested objects are walked. */
export function stripMoney(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => stripMoney(v, depth + 1));
  if (typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (MONEY_KEY.test(k)) continue;
      out[k] = stripMoney(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.replace(CURRENCY_FIGURE, 'an amount');
  return value;
}

export function presentAuditEntry<T extends Record<string, unknown>>(entry: T, viewerRole: Role): T {
  if (viewerRole === Role.OWNER) return entry;
  return {
    ...entry,
    before: stripMoney(entry.before),
    after: stripMoney(entry.after),
    ipAddress: undefined,
    userAgent: undefined,
  } as T;
}
