// Freelancer profile — earnings over time, a fill jar per project deal, every payment as a timeline,
// and their contact & payment details (OWNER).
'use client';

import { Copy, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useQuickActions } from '@/store/quick-actions.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Avatar, Bento, BigNumber, Price, PrivacyChip, Sparkline, Tile } from '@/components/viz';
import { FreelancerDeals } from '@/features/freelancers/freelancer-deals';
import { FreelancerFormDialog } from '@/features/freelancers/freelancer-form-dialog';
import { useDeleteFreelancer, useFreelancer, useLinkLegacyEngagement } from '@/features/freelancers/freelancers.hooks';
import { lastMonths, monthLabel, payDay } from '@/features/payouts/payout-days';
import { PayoutDayTimeline } from '@/features/payouts/payout-timeline';
import { usePayouts, type PayoutRow } from '@/features/payouts/payouts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

const HISTORY_SIZE = 500;
const MONTHS = 12;

export default function FreelancerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fl = useFreelancer(id);
  const payouts = usePayouts({ freelancerId: id, pageSize: HISTORY_SIZE, sort: 'paidAt:desc' });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const remove = useDeleteFreelancer();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);

  if (fl.isLoading) return <PageSkeleton />;
  if (fl.isError || !fl.data) return <ErrorState title="Couldn't open this freelancer" error={fl.error} onRetry={() => fl.refetch()} />;
  const f = fl.data;
  const deals = f.balances.filter((b) => b.projectId);
  const general = f.balances.filter((b) => !b.projectId).reduce((s, b) => s + b.paidPaise, 0);
  const agreed = f.balances.reduce((s, b) => s + b.agreedPaise, 0) + f.legacyEngagements.reduce((s, l) => s + l.agreedPaise, 0);
  const paid = f.balances.reduce((s, b) => s + b.paidPaise, 0);
  // Pending per project deal, plus older (unlinked) agreements not yet covered by general payments.
  const legacyAgreed = f.legacyEngagements.reduce((s, l) => s + l.agreedPaise, 0);
  const owed = f.balances.reduce((s, b) => s + b.pendingPaise, 0) + Math.max(0, legacyAgreed - general);

  const copy = (label: string, value?: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error(`Couldn't copy the ${label.toLowerCase()} — select it and copy by hand.`),
    );
  };

  const removeFreelancer = async () => {
    const ok = await confirm({
      title: `Remove ${f.name}?`,
      description: 'They disappear from pickers. Their payments stay in the ledger for your records.',
      destructive: true,
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      router.push('/freelancers');
    } catch {
      // The global mutation handler shows what went wrong.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={f.name}
        crumbs={[{ label: 'Freelancers', href: '/freelancers' }]}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Avatar id={f._id} name={f.name} size="xs" />
            Freelancer{f.skill ? ` · ${f.skill}` : ''}
          </span>
        }
        description={[f.email, f.phone].filter(Boolean).join(' · ') || undefined}
        action={
          <>
            <PrivacyChip>Only you see these figures</PrivacyChip>
            <Button size="sm" variant="brand" onClick={() => openLogPayment({ payeeType: 'FREELANCER', freelancerId: id })}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Remove freelancer" disabled={remove.isPending} onClick={() => void removeFreelancer()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <Bento>
        <Tile
          span={8}
          title={`Paid over the last ${MONTHS} months`}
          action={
            <Link href={`/payments?freelancerId=${id}`} className="text-xs text-brand-ink hover:underline">
              See in Payments out
            </Link>
          }
        >
          <Earnings rows={payouts.data?.items} loading={payouts.isLoading} error={payouts.error} onRetry={() => payouts.refetch()} paidAllTime={paid} />
        </Tile>
        <Tile span={4} tone="ink" title="Still owed">
          <BigNumber
            caption={
              agreed > 0 ? (
                <>
                  <Price paise={paid} compact /> paid of <Price paise={agreed} compact /> agreed
                </>
              ) : (
                'No agreed fees yet'
              )
            }
          >
            {owed > 0 ? <Price paise={owed} compact className="text-brand" /> : <span className="text-success">Settled</span>}
          </BigNumber>
          {agreed > 0 && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/15" role="img" aria-label={`${Math.round(Math.min(1, paid / agreed) * 100)}% of agreed fees paid`}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (paid / agreed) * 100)}%` }} />
            </div>
          )}
          {general > 0 && (
            <p className="mt-3 text-xs opacity-75">
              Plus <Price paise={general} compact /> paid outside projects.
            </p>
          )}
        </Tile>

        {f.legacyEngagements.length > 0 && (
          <Tile span={12} tone="wash" title="Older agreements to link">
            <LegacyLinks freelancerId={id} items={f.legacyEngagements} />
          </Tile>
        )}

        <Tile span={8} title={`Project deals${deals.length ? ` · ${deals.length}` : ''}`}>
          {deals.length === 0 ? (
            <EmptyState
              illustration="projects"
              title="Not on any project yet"
              description="Open a project → People & payments → Add person → Freelancer, with their agreed fee."
              className="py-8"
            />
          ) : (
            <FreelancerDeals freelancerId={id} deals={deals} />
          )}
        </Tile>

        <Tile span={4} title="Payment details">
          <div className="space-y-2.5 text-sm">
            {[
              ['UPI', f.upiId],
              ['Bank', f.bankName],
              ['Account', f.accountNumber],
              ['IFSC', f.ifsc],
              ['PAN', f.pan],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                {value ? (
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1.5 font-figures text-[13px] hover:text-brand-ink"
                    onClick={() => copy(label!, value)}
                    title={`Copy ${label}`}
                  >
                    <span className="truncate">{value}</span> <Copy className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Not added</span>
                )}
              </div>
            ))}
            {!f.upiId && !f.accountNumber && (
              <button type="button" className="text-xs text-brand-ink hover:underline" onClick={() => setEditOpen(true)}>
                Add UPI or bank details
              </button>
            )}
            {f.notes && <p className="whitespace-pre-line border-t pt-3 text-[13px] text-muted-foreground">{f.notes}</p>}
          </div>
        </Tile>

        <Tile span={12} title="Payments">
          {payouts.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : payouts.isError ? (
            <ErrorState error={payouts.error} onRetry={() => payouts.refetch()} />
          ) : (
            <>
              <PayoutDayTimeline
                rows={payouts.data?.items ?? []}
                showPayee={false}
                onOpen={(r) => openLogPayment({}, r._id)}
                empty={
                  <EmptyState
                    illustration="money"
                    title="No payments yet"
                    description={`When you pay ${f.name}, log it here and their balances update.`}
                    action={
                      <Button size="sm" onClick={() => openLogPayment({ payeeType: 'FREELANCER', freelancerId: id })}>
                        Log payment
                      </Button>
                    }
                    className="py-8"
                  />
                }
              />
              {payouts.data && payouts.data.meta.total > payouts.data.items.length && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Showing the latest {payouts.data.items.length} of {payouts.data.meta.total}.{' '}
                  <Link href={`/payments?freelancerId=${id}`} className="text-brand-ink hover:underline">
                    See them all
                  </Link>
                </p>
              )}
            </>
          )}
        </Tile>
      </Bento>

      <FreelancerFormDialog open={editOpen} onOpenChange={setEditOpen} freelancer={f} />
    </div>
  );
}

/** Monthly paid totals as a sparkline, with the all-time figure and the best month. */
function Earnings({
  rows,
  loading,
  error,
  onRetry,
  paidAllTime,
}: {
  rows: PayoutRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  paidAllTime: number;
}) {
  const months = useMemo(() => lastMonths(MONTHS), []);
  const { values, yearTotal, best } = useMemo(() => {
    const byMonth = new Map<string, number>(months.map((m) => [m, 0]));
    for (const r of rows ?? []) {
      const m = payDay(r).slice(0, 7);
      if (byMonth.has(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + r.amountPaise);
    }
    const vals = months.map((m) => byMonth.get(m) ?? 0);
    let bestIdx = -1;
    vals.forEach((v, i) => {
      if (v > 0 && (bestIdx < 0 || v > vals[bestIdx]!)) bestIdx = i;
    });
    return {
      values: vals,
      yearTotal: vals.reduce((s, v) => s + v, 0),
      best: bestIdx >= 0 ? { month: months[bestIdx]!, paise: vals[bestIdx]! } : null,
    };
  }, [rows, months]);

  if (loading) return <Skeleton className="h-28 w-full" />;
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BigNumber caption="Paid in the last 12 months">
          <Price paise={yearTotal} compact />
        </BigNumber>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            All time <Price paise={paidAllTime} compact className="text-foreground" />
          </p>
          {best && (
            <p>
              Best month {monthLabel(best.month, true)} <Price paise={best.paise} compact className="text-foreground" />
            </p>
          )}
        </div>
      </div>
      {yearTotal > 0 ? (
        <div>
          <Sparkline values={values} height={56} />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{monthLabel(months[0]!, true)}</span>
            <span>{monthLabel(months[months.length - 1]!, true)}</span>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">Nothing paid in the last 12 months.</p>
      )}
    </div>
  );
}

function LegacyLinks({ freelancerId, items }: { freelancerId: string; items: { legacyId: string; projectRef: string; agreedPaise: number }[] }) {
  const projects = useAllProjects();
  const link = useLinkLegacyEngagement();
  const [choice, setChoice] = useState<Record<string, string | undefined>>({});
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">These were imported from the old freelancer records. Pick the project each one belongs to.</p>
      {items.map((l) => (
        <div key={l.legacyId} className="grid gap-2 sm:grid-cols-[1fr_240px_auto] sm:items-center">
          <div className="text-sm">
            <p className="font-medium">“{l.projectRef}”</p>
            <p className="text-xs text-muted-foreground">
              Agreed <Price paise={l.agreedPaise} />
            </p>
          </div>
          <Combobox
            options={(projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name, keywords: p.code }))}
            value={choice[l.legacyId]}
            onChange={(v) => setChoice((c) => ({ ...c, [l.legacyId]: v }))}
            placeholder="Choose project"
            loading={projects.isLoading}
          />
          <Button
            size="sm"
            className="h-9"
            disabled={!choice[l.legacyId] || link.isPending}
            onClick={() => link.mutate({ id: freelancerId, legacyId: l.legacyId, projectId: choice[l.legacyId]! })}
          >
            Link
          </Button>
        </div>
      ))}
    </div>
  );
}
