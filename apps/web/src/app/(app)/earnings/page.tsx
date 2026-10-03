// My earnings — a team member's own money view: what was agreed per project, what's been paid,
// what's still pending, every payment received, and payslips for salaried pay.
// Everything here is the viewer's own pay, so every amount goes through <Price own>.
'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PAYOUT_CATEGORY_LABEL, PAYOUT_METHOD_LABEL } from '@agency/shared';

import { csvMoney, downloadCsv } from '@/lib/csv';
import { env } from '@/lib/env';
import { toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { statusLabel } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import {
  ActivityTimeline,
  Bento,
  BigNumber,
  FillJar,
  formatCompact,
  Hero,
  HeroFigure,
  Price,
  PrivacyChip,
  ProjectChip,
  Tile,
  useCanSeePrices,
} from '@/components/viz';
import { useMyPayslips } from '@/features/payroll/payroll.hooks';
import { useMyEarnings, type MyEarnings } from '@/features/payouts/payouts.hooks';

const RECEIPTS_SHOWN = 10;

export default function EarningsPage() {
  const earnings = useMyEarnings();
  const tab = useSearchParams().get('tab');
  const t = earnings.data?.totals;

  // Old links used tabs (?tab=payments / ?tab=payslips) — scroll to that section instead.
  useEffect(() => {
    if (!tab || earnings.isLoading) return;
    document.getElementById(tab)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [tab, earnings.isLoading]);

  const exportPayments = () => {
    const rows = earnings.data?.payouts ?? [];
    downloadCsv(
      'my-payments',
      ['Date', 'Project', 'Kind', 'Method', 'Reference', 'Note', 'Amount (₹)'],
      rows.map((p) => [p.paidAt.slice(0, 10), p.projectName ?? 'General', PAYOUT_CATEGORY_LABEL[p.category], PAYOUT_METHOD_LABEL[p.method], p.reference, p.note, csvMoney(p.amountPaise)]),
    );
  };

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="My earnings"
        loading={earnings.isLoading}
        aside={<PrivacyChip>Only you see these figures</PrivacyChip>}
        lede="What you've agreed, been paid and are still owed, project by project."
      >
        <EarningsSentence totals={t} />
      </Hero>

      {earnings.isError ? (
        <ErrorState error={earnings.error} onRetry={() => earnings.refetch()} />
      ) : (
        <Bento>
          <Tile span={8} title="Received by month">
            {earnings.isLoading ? <Skeleton className="h-52 w-full" /> : <MonthlyBars payouts={earnings.data?.payouts ?? []} />}
          </Tile>

          <Tile span={4} tone="ink" title="This financial year">
            {earnings.isLoading ? (
              <Skeleton className="h-24 w-full bg-background/20" />
            ) : (
              <div className="space-y-5">
                <BigNumber>
                  <Price paise={t?.thisFyPaise ?? 0} own className="font-display text-brand" />
                </BigNumber>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-background/70">This month</dt>
                    <dd>
                      <Price paise={t?.thisMonthPaise ?? 0} own />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-background/70">All time</dt>
                    <dd>
                      <Price paise={t?.allTimePaise ?? 0} own />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-background/20 pt-2">
                    <dt className="text-background/70">Still pending</dt>
                    <dd className="font-semibold">
                      <Price paise={t?.pendingPaise ?? 0} own />
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </Tile>

          <Tile span={12} title="By project">
            {earnings.isLoading ? <TableSkeleton rows={2} columns={4} /> : <ProjectJars projects={earnings.data?.projects ?? []} />}
          </Tile>

          <Tile
            span={7}
            title="Payments received"
            action={
              <Button variant="outline" size="sm" onClick={exportPayments} disabled={!earnings.data?.payouts.length}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            }
          >
            <div id="payments" className="scroll-mt-32">
              {earnings.isLoading ? <TableSkeleton rows={3} columns={3} /> : <Receipts payouts={earnings.data?.payouts ?? []} />}
            </div>
          </Tile>

          <Tile span={5} title="Payslips">
            <div id="payslips" className="scroll-mt-32">
              <Payslips />
            </div>
          </Tile>
        </Bento>
      )}
    </div>
  );
}

function EarningsSentence({ totals: t }: { totals?: MyEarnings['totals'] }) {
  if (!t) return <>My earnings</>;
  const pending =
    t.pendingPaise > 0 ? (
      <>
        <HeroFigure>
          <Price paise={t.pendingPaise} own compact className="font-display" />
        </HeroFigure>{' '}
        is still to come
      </>
    ) : null;
  if (t.thisMonthPaise > 0) {
    return (
      <>
        You&rsquo;ve received <HeroFigure><Price paise={t.thisMonthPaise} own compact className="font-display" /></HeroFigure> this month
        {pending ? <>, and {pending}</> : null}.
      </>
    );
  }
  if (t.allTimePaise > 0) {
    return <>Nothing received yet this month{pending ? <> — {pending}</> : null}.</>;
  }
  if (pending) return <>Your first payment is on its way — {pending}.</>;
  return <>No earnings yet. They&rsquo;ll show here once you&rsquo;re on a project with an agreed fee.</>;
}

function MonthlyBars({ payouts }: { payouts: MyEarnings['payouts'] }) {
  const canSee = useCanSeePrices(true);
  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: toLocalDateInput(d).slice(0, 7), month: d.toLocaleDateString('en-IN', { month: 'short' }), received: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const p of payouts) {
      const m = byKey.get(toLocalDateInput(p.paidAt).slice(0, 7));
      if (m) m.received += p.amountPaise;
    }
    return months;
  }, [payouts]);

  if (data.every((d) => d.received === 0)) {
    return <EmptyState illustration="money" title="No payments in the last 12 months" description="Each month you're paid, a bar grows here." className="py-8" />;
  }
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={canSee ? 48 : 0}
            tickFormatter={(v: number) => (canSee ? formatCompact(v) : '')}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            content={({ active, payload, label }) =>
              active && payload?.length && canSee ? (
                <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                  <p className="font-medium">{label}</p>
                  <p className="font-figures">{formatCompact(Number(payload[0]!.value ?? 0))} received</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="received" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProjectJars({ projects }: { projects: MyEarnings['projects'] }) {
  if (projects.length === 0) {
    return <EmptyState illustration="money" title="No project earnings yet" description="When you're added to a project with an agreed fee, it shows up here." className="py-8" />;
  }
  const withProject = projects.filter((p) => p.projectId);
  const other = projects.find((p) => !p.projectId);
  return (
    <div className="space-y-4">
      {withProject.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">Each jar fills as your agreed fee for that project reaches you.</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {withProject.map((p) => {
              const pct = p.agreedPaise > 0 ? Math.round((p.paidPaise / p.agreedPaise) * 100) : null;
              return (
                <li key={p.projectId} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <FillJar value={p.paidPaise} max={p.agreedPaise} size="lg" label={`${p.projectName}: ${pct === null ? 'no fee agreed' : `${pct}% paid`}`} />
                  <ProjectChip id={p.projectId!} name={p.projectName} href={`/projects/${p.projectId}`} className="max-w-full text-[13px] font-semibold" />
                  <span className="text-xs text-muted-foreground">
                    {p.agreedPaise > 0 ? (
                      <>
                        <Price paise={p.paidPaise} own compact /> of <Price paise={p.agreedPaise} own compact />
                      </>
                    ) : p.paidPaise > 0 ? (
                      <>
                        <Price paise={p.paidPaise} own compact /> paid · no fee agreed
                      </>
                    ) : (
                      'No fee agreed yet'
                    )}
                  </span>
                  {p.pendingPaise > 0 && (
                    <span className="text-[11px] font-medium text-warning">
                      <Price paise={p.pendingPaise} own compact /> to come
                    </span>
                  )}
                  {p.projectStatus && <span className="text-[11px] text-muted-foreground">{statusLabel(p.projectStatus)}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {other && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
          <span>
            <span className="font-medium">Other payments</span>
            <span className="text-muted-foreground">
              {' '}
              · {other.payoutCount} payment{other.payoutCount === 1 ? '' : 's'} not tied to a project
            </span>
          </span>
          <Price paise={other.paidPaise} own className="font-semibold" />
        </div>
      )}
    </div>
  );
}

function Receipts({ payouts }: { payouts: MyEarnings['payouts'] }) {
  const [all, setAll] = useState(false);
  if (payouts.length === 0) {
    return <EmptyState illustration="inbox" title="No payments received yet" description="Each payment you receive gets a receipt here." className="py-8" />;
  }
  const sorted = [...payouts].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const shown = all ? sorted : sorted.slice(0, RECEIPTS_SHOWN);
  return (
    <div className="space-y-3">
      <ActivityTimeline
        items={shown.map((p) => ({
          key: p._id,
          date: p.paidAt,
          color: p.projectId ? `hsl(var(--success))` : 'hsl(var(--muted-foreground))',
          title: (
            <div className="-mt-1 rounded-lg border border-dashed bg-background px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {p.projectId ? (
                    <Link href={`/projects/${p.projectId}`} className="hover:underline">
                      {p.projectName ?? 'Project'}
                    </Link>
                  ) : (
                    PAYOUT_CATEGORY_LABEL[p.category]
                  )}
                </span>
                <Price paise={p.amountPaise} currency={p.currency} own className="shrink-0 text-[15px] font-semibold" />
              </div>
              <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                {formatDate(p.paidAt)} · {PAYOUT_METHOD_LABEL[p.method] ?? 'Paid'}
                {p.projectId && p.category !== 'PROJECT_FEE' ? ` · ${PAYOUT_CATEGORY_LABEL[p.category]}` : ''}
                {p.reference ? ` · ref ${p.reference}` : ''}
              </p>
              {p.note && <p className="mt-1 text-xs font-normal text-muted-foreground">{p.note}</p>}
            </div>
          ),
        }))}
      />
      {sorted.length > RECEIPTS_SHOWN && (
        <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${sorted.length} payments`}
        </Button>
      )}
    </div>
  );
}

function Payslips() {
  const slips = useMyPayslips();
  if (slips.isLoading) return <TableSkeleton rows={3} columns={3} />;
  if (slips.isError) return <ErrorState error={slips.error} onRetry={() => slips.refetch()} className="py-6" />;
  if ((slips.data ?? []).length === 0) {
    return <EmptyState illustration="files" title="No payslips" description="Payslips appear here if you're on monthly salary." className="py-8" />;
  }
  return (
    <ul className="divide-y">
      {slips.data!.map((s) => (
        <li key={s._id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{new Date(`${s.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
            <p className="truncate text-xs text-muted-foreground">
              Gross <Price paise={s.grossPaise} currency={s.currency} own /> · deductions <Price paise={s.deductionsPaise} currency={s.currency} own />
            </p>
          </div>
          <Price paise={s.netPaise} currency={s.currency} own className="font-semibold" />
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={`${env.apiBaseUrl}/payroll/payslips/${s._id}/pdf`} target="_blank" rel="noreferrer" aria-label="Download payslip PDF">
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
