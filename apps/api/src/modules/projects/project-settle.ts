// What settling someone's project fee means in numbers — pure, so it's easy to test.
import type { SettleAction } from '@agency/shared';

/**
 * PAY_REST pays whatever is still owed. SETTLE_AT_PAID lowers the agreed fee to what was paid, so
 * nothing is owed (it never raises a fee, so an over-payment stays visible). KEEP_OWED changes nothing.
 */
export function settleOutcome(agreedPaise: number, paidPaise: number, action: SettleAction): { payPaise: number; newAgreed?: number } {
  const pending = Math.max(0, agreedPaise - paidPaise);
  if (action === 'PAY_REST') return { payPaise: pending };
  if (action === 'SETTLE_AT_PAID' && paidPaise < agreedPaise) return { payPaise: 0, newAgreed: paidPaise };
  return { payPaise: 0 };
}
