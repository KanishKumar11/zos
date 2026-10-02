// Payroll runs — OWNER+ADMIN. Start a draft for a month, then review, finalize and mark paid on the run page.
'use client';

import { Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PayrollStatus, Role } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { thisMonthLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, sortRows, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { useListState } from '@/lib/list-state';
import {
  isLegacyProjectRun,
  monthTitle,
  useCreatePayrollRun,
  usePayrollRuns,
  type PayrollRunRow,
} from '@/features/payroll/payroll.hooks';

export default function PayrollPage() {
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]} fallback={<EmptyState title="Payroll is only for the owner and admins" />}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const runs = usePayrollRuns();
  const list = useListState('payroll', { sort: 'month:desc' });
  const [createOpen, setCreateOpen] = useState(false);
  const all = runs.data ?? [];

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
        <span>
          {r.employeeCount}
          {(r.skipped?.length ?? 0) > 0 && <span className="block text-[11px] text-amber-600">{r.skipped!.length} left out</span>}
        </span>
      ),
    },
    {
      id: 'net',
      header: 'Total net',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.totalNetPaise,
      cell: (r) => <span className="font-medium">{formatPaise(r.totalNetPaise)}</span>,
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
        <Link href={`/payroll/runs/${r._id}`} className="text-sm text-primary hover:underline">
          {r.status === PayrollStatus.DRAFT ? 'Review' : 'View'}
        </Link>
      ),
    },
  ];

  const sorted = sortRows(all, columns, list.sort);
  const regular = all.filter((r) => !isLegacyProjectRun(r));
  const drafts = regular.filter((r) => r.status === PayrollStatus.DRAFT).length;
  const awaitingPayment = regular.filter((r) => r.status === PayrollStatus.FINALIZED);
  const lastPaid = regular.find((r) => r.status === PayrollStatus.PAID);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Monthly salary runs: review payslips, finalize to send them, then mark paid."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New run
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Drafts to review" loading={runs.isLoading} value={String(drafts)} tone={drafts ? 'warning' : 'default'} />
        <StatCard
          label="Finalized, not yet paid"
          loading={runs.isLoading}
          value={formatPaise(awaitingPayment.reduce((s, r) => s + r.totalNetPaise, 0))}
          hint={awaitingPayment.length ? awaitingPayment.map((r) => monthTitle(r.month)).join(', ') : 'Nothing waiting'}
          tone={awaitingPayment.length ? 'warning' : 'default'}
        />
        <StatCard
          label="Last paid run"
          loading={runs.isLoading}
          value={lastPaid ? formatPaise(lastPaid.totalNetPaise) : '—'}
          hint={lastPaid ? monthTitle(lastPaid.month) : 'No paid runs yet'}
        />
      </div>

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
            icon={Wallet}
            title="No payroll runs yet"
            description="Start a draft for a month. Everyone with a pay package is included; you can review before anything is sent."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Start your first run
              </Button>
            }
          />
        }
      />

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
                <Link href={`/payroll/runs/${existing._id}`} className="text-primary hover:underline" onClick={() => onOpenChange(false)}>
                  Open the existing {monthTitle(month)} run
                </Link>
              ) : future ? (
                'This month hasn’t started — attendance won’t count until it does.'
              ) : undefined
            }
          >
            <Input type="month" value={month} onChange={(e) => {
                setMonth(e.target.value);
                setError(undefined);
              }} />
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
