// Settle choice — what happens to someone's agreed fee when they stop working on a project or the
// project closes. Shows the real amounts for each option (OWNER only — these screens are owner-only).
'use client';

import { PAYOUT_METHOD_LABEL, PayoutMethod, type SettleAction } from '@agency/shared';

import { cn } from '@/lib/cn';

import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Price } from '@/components/viz';

export function settleOptions(agreed: number, paid: number) {
  const pending = Math.max(0, agreed - paid);
  return { pending, nothingOwed: pending === 0 };
}

/** Big radio cards for one person. */
export function SettleChoice({
  value,
  onChange,
  agreedPaise,
  paidPaise,
  currency = 'INR',
  name,
}: {
  value: SettleAction;
  onChange: (v: SettleAction) => void;
  agreedPaise: number;
  paidPaise: number;
  currency?: string;
  name: string;
}) {
  const { pending, nothingOwed } = settleOptions(agreedPaise, paidPaise);
  if (nothingOwed) {
    return (
      <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        Nothing is owed to {name} on this project
        {agreedPaise > 0 && (
          <>
            {' '}
            — <Price paise={paidPaise} currency={currency} /> paid of <Price paise={agreedPaise} currency={currency} /> agreed
          </>
        )}
        .
      </p>
    );
  }
  const options: { v: SettleAction; title: React.ReactNode; body: React.ReactNode }[] = [
    {
      v: 'PAY_REST',
      title: (
        <>
          Mark the rest as paid — <Price paise={pending} currency={currency} />
        </>
      ),
      body: 'Logs a payment for what is still owed, so the fee shows as paid in full.',
    },
    {
      v: 'SETTLE_AT_PAID',
      title: (
        <>
          Settle at what&apos;s been paid — <Price paise={paidPaise} currency={currency} />
        </>
      ),
      body: (
        <>
          Lowers the agreed fee from <Price paise={agreedPaise} currency={currency} /> to what they&apos;ve received. Nothing more is owed.
        </>
      ),
    },
    {
      v: 'KEEP_OWED',
      title: (
        <>
          Still owe them <Price paise={pending} currency={currency} />
        </>
      ),
      body: 'Keeps the balance outstanding; it stays on your "who you owe" list until you pay it.',
    },
  ];
  return (
    <div role="radiogroup" aria-label={`What happens to ${name}'s fee`} className="grid gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-left transition-colors',
            value === o.v ? 'border-foreground bg-card ring-1 ring-foreground' : 'hover:border-foreground/30',
          )}
        >
          <span className="block text-sm font-semibold">{o.title}</span>
          <span className="block text-xs text-muted-foreground">{o.body}</span>
        </button>
      ))}
    </div>
  );
}

/** Compact select for one row in a list (close-out). */
export function SettleSelect({ value, onChange, pendingPaise, label }: { value: SettleAction; onChange: (v: SettleAction) => void; pendingPaise: number; label: string }) {
  if (pendingPaise <= 0) return <span className="text-xs text-success">Nothing owed</span>;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as SettleAction)} aria-label={label} className="h-8 w-auto text-[13px]">
      <option value="PAY_REST">Mark the rest as paid</option>
      <option value="SETTLE_AT_PAID">Settle at what&apos;s paid</option>
      <option value="KEEP_OWED">Still owed</option>
    </Select>
  );
}

/** Date + method for a "mark the rest as paid" payment. */
export function SettlePaymentFields({
  paidAt,
  method,
  onChange,
}: {
  paidAt: string;
  method: PayoutMethod;
  onChange: (v: { paidAt?: string; method?: PayoutMethod }) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Paid on" htmlFor="settle-date">
        <Input id="settle-date" type="date" value={paidAt} onChange={(e) => onChange({ paidAt: e.target.value })} />
      </FormField>
      <FormField label="How" htmlFor="settle-method">
        <Select id="settle-method" value={method} onChange={(e) => onChange({ method: e.target.value as PayoutMethod })}>
          {Object.values(PayoutMethod).map((m) => (
            <option key={m} value={m}>
              {PAYOUT_METHOD_LABEL[m]}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
