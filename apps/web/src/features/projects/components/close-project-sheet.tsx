// Close project (OWNER) — one place to wrap a project up: settle what the client still owes (write
// off open invoices, stop expecting the unbilled budget) and settle everyone's fee, then mark it done.
'use client';

import { useEffect, useMemo, useState } from 'react';

import { PayeeType, PayoutMethod, type SettleAction } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Avatar, FillJar, Price } from '@/components/viz';
import { useInvoiceList, type InvoiceRow } from '@/features/invoices/invoices.hooks';
import { WriteOffDialog } from '@/features/invoices/write-off-dialog';
import { useProjectPayoutBalances } from '@/features/payouts/payouts.hooks';

import { useCloseProject, useProjectBalance, type ProjectRow } from '../projects.hooks';
import { SettlePaymentFields, SettleSelect } from './settle-choice';

const keyOf = (t: PayeeType, id: string) => `${t}:${id}`;

export function CloseProjectSheet({ project, open, onOpenChange }: { project: ProjectRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const cur = project.currency ?? 'INR';
  const balance = useProjectBalance(project._id, { enabled: open });
  const invoices = useInvoiceList({ projectId: project._id, status: 'open' }, open);
  const people = useProjectPayoutBalances(open ? project._id : undefined);
  const close = useCloseProject();

  const [actions, setActions] = useState<Record<string, SettleAction>>({});
  const [writeOff, setWriteOff] = useState(false);
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [method, setMethod] = useState<PayoutMethod>(PayoutMethod.BANK);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [writingOff, setWritingOff] = useState<InvoiceRow | null>(null);

  useEffect(() => {
    if (open) {
      setActions({});
      setWriteOff(false);
      setPaidAt(todayLocal());
      setNote('');
      setError(undefined);
    }
  }, [open]);

  const owed = useMemo(() => (people.data ?? []).filter((r) => r.pendingPaise > 0), [people.data]);
  const actionFor = (t: PayeeType, id: string): SettleAction => actions[keyOf(t, id)] ?? 'KEEP_OWED';
  const setAll = (a: SettleAction) => setActions(Object.fromEntries(owed.map((r) => [keyOf(r.payeeType, r.payeeId), a])));
  const payingSomeone = owed.some((r) => actionFor(r.payeeType, r.payeeId) === 'PAY_REST');
  const payTotal = owed.filter((r) => actionFor(r.payeeType, r.payeeId) === 'PAY_REST').reduce((s, r) => s + r.pendingPaise, 0);

  const b = balance.data;
  const unbilled = b ? Math.max(0, b.budgetPaise - b.invoicedPaise) : 0;
  const openInvoices = invoices.data ?? [];

  const submit = async () => {
    setError(undefined);
    try {
      await close.mutateAsync({
        id: project._id,
        body: {
          writeOff,
          people: owed.map((r) => ({ payeeType: r.payeeType, id: r.payeeId, action: actionFor(r.payeeType, r.payeeId) })),
          paidAt,
          method,
          note: note.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Close {project.name}</SheetTitle>
          <SheetDescription>Marks the project as completed and settles the money on both sides. You can review everything before it happens.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {/* Client side */}
          <section className="space-y-3">
            <h3 className="font-display text-lg font-bold">From the client</h3>
            {balance.isLoading ? (
              <Skeleton className="h-16" />
            ) : balance.isError ? (
              <ErrorState error={balance.error} onRetry={() => balance.refetch()} className="py-4" />
            ) : b ? (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Fig label="Budget">
                  <Price paise={b.budgetPaise} currency={cur} />
                </Fig>
                <Fig label="Billed">
                  <Price paise={b.invoicedPaise} currency={cur} />
                </Fig>
                <Fig label="Collected">
                  <Price paise={b.collectedPaise} currency={cur} />
                </Fig>
              </div>
            ) : null}

            {invoices.isLoading ? (
              <Skeleton className="h-10" />
            ) : openInvoices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {openInvoices.length === 1 ? 'One invoice is' : `${openInvoices.length} invoices are`} still open. Write off anything the client won&apos;t pay:
                </p>
                <ul className="divide-y rounded-xl border">
                  {openInvoices.map((inv) => (
                    <li key={inv._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-mono text-[12.5px]">{inv.number}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        <Price paise={inv.balancePaise ?? Math.max(0, inv.totalPaise - inv.paidPaise)} currency={inv.currency} /> unpaid
                      </span>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setWritingOff(inv)}>
                        Write off
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open invoices on this project.</p>
            )}

            {unbilled > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={writeOff} onChange={(e) => setWriteOff(e.target.checked)} />
                <span className="text-sm">
                  <span className="font-semibold">
                    Write off the unbilled <Price paise={unbilled} currency={cur} />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Part of the budget was never invoiced. Tick this if you don&apos;t expect it, so the project stops showing as behind on billing.
                  </span>
                </span>
              </label>
            )}
          </section>

          {/* People side */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold">Team &amp; freelancers</h3>
              {owed.length > 1 && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setAll('PAY_REST')}>
                    Everyone paid in full
                  </Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setAll('SETTLE_AT_PAID')}>
                    Settle all at paid
                  </Button>
                </div>
              )}
            </div>
            {people.isLoading ? (
              <Skeleton className="h-24" />
            ) : people.isError ? (
              <ErrorState error={people.error} onRetry={() => people.refetch()} className="py-4" />
            ) : (people.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody was on this project.</p>
            ) : (
              <ul className="grid gap-2">
                {(people.data ?? []).map((r) => (
                  <li key={keyOf(r.payeeType, r.payeeId)} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2">
                    <Avatar id={r.payeeId} name={r.payeeName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {r.payeeName}
                        {r.payeeType === PayeeType.FREELANCER && <Badge variant="info">Freelancer</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Price paise={r.paidPaise} currency={cur} /> paid of <Price paise={r.agreedPaise} currency={cur} />
                        {r.pendingPaise > 0 && (
                          <>
                            {' · '}
                            <span className="text-warning">
                              <Price paise={r.pendingPaise} currency={cur} /> owed
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <FillJar value={r.paidPaise} max={r.agreedPaise} size="sm" />
                    <SettleSelect
                      value={actionFor(r.payeeType, r.payeeId)}
                      onChange={(a) => setActions((cur) => ({ ...cur, [keyOf(r.payeeType, r.payeeId)]: a }))}
                      pendingPaise={r.pendingPaise}
                      label={`What happens to ${r.payeeName}'s fee`}
                    />
                  </li>
                ))}
              </ul>
            )}
            {payingSomeone && (
              <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-sm">
                  This logs <Price paise={payTotal} currency={cur} className="font-semibold" /> of payments.
                </p>
                <SettlePaymentFields
                  paidAt={paidAt}
                  method={method}
                  onChange={(v) => {
                    if (v.paidAt !== undefined) setPaidAt(v.paidAt);
                    if (v.method) setMethod(v.method);
                  }}
                />
              </div>
            )}
          </section>

          <FormField label="Closing note (optional)" htmlFor="close-note">
            <Input id="close-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client paused the app; final payments settled" maxLength={500} />
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={close.isPending || people.isLoading}>
            {close.isPending ? 'Closing…' : 'Close project'}
          </Button>
        </div>
        {writingOff && <WriteOffDialog invoice={writingOff} open={!!writingOff} onOpenChange={(v) => !v && setWritingOff(null)} />}
      </SheetContent>
    </Sheet>
  );
}

function Fig({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-figures font-semibold">{children}</p>
    </div>
  );
}
