// Payroll runs — OWNER only. Start a draft for a month, then review, finalize and mark paid on the run page.
'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PayrollStatus, Role } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { thisMonthLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, sortRows, type Column } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Bento, BigNumber, Hero, HeroFigure, HeroMark, Price, PrivacyChip, Sparkline, Tile, TrendDelta, useCanSeePrices } from '@/components/viz';
import {
  isLegacyProjectRun,
  monthTitle,
  useCreatePayrollRun,
  usePayrollRuns,
  type PayrollRunRow,
} from '@/features/payroll/payroll.hooks';

export default function PayrollPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState illustration="people" title="Payroll is only for the owner" />}>
      <Inner />
    </RoleGate>
  );
}

/** "2026-10" → "October". */
const monthName = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long' }) : month;
};
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

function Inner() {
  const runs = usePayrollRuns();
  const canSee = useCanSeePrices();
  const list = useListState('payroll', { sort: 'month:desc' });
  const [createOpen, setCreateOpen] = useState(false);
  const all = runs.data ?? [];
  const month = thisMonthLocal();

  const columns: Column<PayrollRunRow>[] = [
    {
      id: 'month',
      header: 'Month',
      sortable: true,
      sortValue: (r) => r.month,
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/payroll/runs/${r._id}`} className="font-medium hover:underline">
            {monthTitle(r.month)}
          </Link>
          {isLegacyProjectRun(r) && <Badge variant="muted">Legacy project payouts</Badge>}
        </div>
      ),
    },
    { id: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'people',
      header: 'People',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.employeeCount,
      cell: (r) => (
        <span className="font-figures">
          {r.employeeCount}
          {(r.skipped?.length ?? 0) > 0 && <span className="block font-sans text-[11px] text-warning">{r.skipped!.length} left out</span>}
        </span>
      ),
    },
    {
      id: 'net',
      header: 'Total net',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.totalNetPaise,
      cell: (r) => <Price paise={r.totalNetPaise} className="font-medium" />,
    },
    {
      id: 'when',
      header: 'Finalized / paid',
      hideBelow: 'md',
      cell: (r) =>
        r.paidAt ? (
          <span>Paid {formatDate(r.paidAt)}</span>
        ) : r.finalizedAt ? (
          <span>Finalized {formatDate(r.finalizedAt)}</span>
        ) : (
          <span className="text-muted-foreground">Not yet</span>
        ),
    },
    {
      id: 'open',
      header: '',
      align: 'right',
      cell: (r) => (
        <Link href={`/payroll/runs/${r._id}`} className="text-sm font-medium text-brand-ink hover:underline">
          {r.status === PayrollStatus.DRAFT ? 'Review' : 'View'}
        </Link>
      ),
    },
  ];

  const sorted = sortRows(all, columns, list.sort);
  const regular = all.filter((r) => !isLegacyProjectRun(r));
  const drafts = regular.filter((r) => r.status === PayrollStatus.DRAFT);
  const awaitingPayment = regular.filter((r) => r.status === PayrollStatus.FINALIZED);
  const byMonth = [...regular].sort((a, b) => a.month.localeCompare(b.month));
  const lastPaid = [...byMonth].reverse().find((r) => r.status === PayrollStatus.PAID);
  const current = regular.find((r) => r.month === month);
  const previous = [...byMonth].reverse().find((r) => r.month < month);
  // Net payroll over the last 12 runs, oldest first (sparkline: owner only).
  const trend = byMonth.slice(-12);
  const latest = trend[trend.length - 1];
  const beforeLatest = trend[trend.length - 2];

  const statusLine = (r: PayrollRunRow) =>
    r.status === PayrollStatus.PAID
      ? `Paid${r.paidAt ? ` on ${formatDate(r.paidAt)}` : ''}.`
      : r.status === PayrollStatus.FINALIZED
        ? 'Finalized — payslips are out, waiting to be marked paid.'
        : 'Still a draft — review it, then finalize to send payslips.';

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Payroll"
        eyebrow={`Payroll · ${monthTitle(month)}`}
        loading={runs.isLoading}
        aside={
          <>
            {all.length > 0 && <PrivacyChip>Only you see these figures</PrivacyChip>}
            <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New run
            </Button>
          </>
        }
        lede={
          runs.error ? undefined : current ? (
            <>
              {statusLine(current)}
              {awaitingPayment.some((r) => r._id !== current._id) && ` ${awaitingPayment.filter((r) => r._id !== current._id).map((r) => monthName(r.month)).join(', ')} still to be marked paid.`}
            </>
          ) : previous ? (
            <>
              {monthName(previous.month)} was <Price paise={previous.totalNetPaise} className="font-medium text-foreground" /> for {people(previous.employeeCount)} — {statusLine(previous).charAt(0).toLowerCase() + statusLine(previous).slice(1)}
            </>
          ) : (
            'Start a draft for a month. Everyone with a pay package is included, and nothing is sent until you finalize.'
          )
        }
      >
        {runs.error ? (
          'Couldn’t load payroll.'
        ) : current ? (
          <>
            {monthName(current.month)} payroll:{' '}
            <HeroFigure>
              <Price paise={current.totalNetPaise} compact />
            </HeroFigure>{' '}
            net for {people(current.employeeCount)}.
          </>
        ) : (
          <>
            Payroll for <HeroMark>{monthName(month)}</HeroMark> hasn’t been run yet.
          </>
        )}
      </Hero>

      {runs.isLoading ? (
        <div className="grid gap-3.5 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-[var(--radius)] lg:col-span-2" />
          <Skeleton className="h-40 rounded-[var(--radius)]" />
        </div>
      ) : (
        !runs.error &&
        regular.length > 0 && (
          <Bento>
            <Tile
              span={8}
              title={`Net payroll · last ${trend.length} ${trend.length === 1 ? 'run' : 'runs'}`}
              action={latest && beforeLatest && canSee ? <TrendDelta current={latest.totalNetPaise} previous={beforeLatest.totalNetPaise} invert suffix={`vs ${monthName(beforeLatest.month)}`} /> : undefined}
            >
              {trend.length >= 2 && canSee ? (
                <>
                  <Sparkline values={trend.map((r) => r.totalNetPaise / 100)} height={72} />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{monthTitle(trend[0]!.month)}</span>
                    <span>{monthTitle(latest!.month)}</span>
                  </div>
                </>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">The trend shows up once there are two or more runs.</p>
              )}
            </Tile>
            <Tile span={4} tone="ink" title="Last paid run">
              {lastPaid ? (
                <BigNumber className="[&>div]:text-brand" caption={`${monthTitle(lastPaid.month)} · ${people(lastPaid.employeeCount)}${lastPaid.paidAt ? ` · paid ${formatDate(lastPaid.paidAt)}` : ''}`}>
                  <Price paise={lastPaid.totalNetPaise} compact />
                </BigNumber>
              ) : (
                <BigNumber caption="No run has been marked paid yet">—</BigNumber>
              )}
              <div className="mt-4 space-y-1 text-xs opacity-80">
                <p>
                  {drafts.length ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'} to review` : 'No drafts waiting'}
                </p>
                <p>
                  {awaitingPayment.length ? (
                    <>
                      <Price paise={awaitingPayment.reduce((s, r) => s + r.totalNetPaise, 0)} compact /> finalized, not yet paid
                    </>
                  ) : (
                    'Nothing waiting to be paid'
                  )}
                </p>
              </div>
            </Tile>
          </Bento>
        )
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold">All runs</h2>
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(r) => r._id}
          loading={runs.isLoading}
          error={runs.error}
          onRetry={() => runs.refetch()}
          sort={list.sort}
          onSortChange={list.setSort}
          rowHref={(r) => `/payroll/runs/${r._id}`}
          empty={
            <EmptyState
              illustration="people"
              title="No payroll runs yet"
              description="Start a draft for a month. Everyone with a pay package is included; you can review before anything is sent."
              action={
                <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
                  Start your first run
                </Button>
              }
            />
          }
        />
      </div>

      <NewRunDialog open={createOpen} onOpenChange={setCreateOpen} runs={all} />
    </div>
  );
}

function NewRunDialog({ open, onOpenChange, runs }: { open: boolean; onOpenChange: (o: boolean) => void; runs: PayrollRunRow[] }) {
  const router = useRouter();
  const create = useCreatePayrollRun();
  const [month, setMonth] = useState(thisMonthLocal());
  const [error, setError] = useState<string>();
  const existing = runs.find((r) => r.month === month);
  const future = month > thisMonthLocal();

  const submit = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Pick a month');
    if (existing) return setError(`There is already a run for ${monthTitle(month)}.`);
    setError(undefined);
    try {
      const run = await create.mutateAsync({ month });
      onOpenChange(false);
      router.push(`/payroll/runs/${run._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setMonth(thisMonthLocal());
          setError(undefined);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>Creates a draft with a payslip for everyone who has a pay package that month. Nothing is sent yet.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField
            label="Month"
            error={error}
            hint={
              existing ? (
                <Link href={`/payroll/runs/${existing._id}`} className="text-brand-ink hover:underline" onClick={() => onOpenChange(false)}>
                  Open the existing {monthTitle(month)} run
                </Link>
              ) : future ? (
                'This month hasn’t started — attendance won’t count until it does.'
              ) : undefined
            }
          >
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !!existing}>
              {create.isPending ? 'Creating…' : 'Create draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
