// Payroll run — payslips, people left out, review → finalize → mark paid, reopen (owner), CSV export.
'use client';

import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw, RotateCcw, Users } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';

import { PAYROLL_SKIP_REASON_LABEL, PayrollSkipReason, PayrollStatus, Role } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { env } from '@/lib/env';
import { todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { isOwner } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  isLegacyProjectRun,
  monthTitle,
  payrollApi,
  useFinalizePayrollRun,
  useMarkPayrollPaid,
  usePayrollRun,
  useRecomputePayrollRun,
  useReopenPayrollRun,
  useRunPayslips,
  type PayrollRunRow,
  type PayslipRow,
} from '@/features/payroll/payroll.hooks';
import { PayslipSheet } from '@/features/payroll/payslip-sheet';
import { useSettings } from '@/features/settings/settings.hooks';
import { toast } from 'sonner';

export default function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]} fallback={<EmptyState title="Payroll is only for the owner and admins" />}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const run = usePayrollRun(id);
  const slips = useRunPayslips(id);
  const settings = useSettings();
  const recompute = useRecomputePayrollRun();
  const reopen = useReopenPayrollRun();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => slips.data ?? [], [slips.data]);
  const totals = useMemo(
    () => ({
      gross: rows.reduce((s, r) => s + r.grossPaise, 0),
      deductions: rows.reduce((s, r) => s + r.deductionsPaise, 0),
      net: rows.reduce((s, r) => s + r.netPaise, 0),
      lop: rows.reduce((s, r) => s + r.lopDays, 0),
      unmarked: rows.reduce((s, r) => s + (r.unmarkedDays ?? 0), 0),
      bonuses: rows.reduce((s, r) => s + r.breakdown.bonusPaise, 0),
      manualDeductions: rows.reduce((s, r) => s + r.breakdown.manualDeductionPaise, 0),
    }),
    [rows],
  );

  if (run.isLoading) return <PageSkeleton />;
  if (!run.data) {
    const missing = run.error instanceof ApiRequestError && run.error.status === 404;
    return missing ? (
      <EmptyState
        title="This payroll run no longer exists"
        action={
          <Link href="/payroll">
            <Button variant="outline" size="sm">Back to payroll</Button>
          </Link>
        }
      />
    ) : (
      <ErrorState title="Couldn't open this payroll run" error={run.error} onRetry={() => run.refetch()} />
    );
  }

  const r = run.data;
  const title = `${monthTitle(r.month)} payroll`;
  const editable = r.status === PayrollStatus.DRAFT;
  const legacy = isLegacyProjectRun(r);
  const selected = rows.find((s) => s._id === selectedId);
  const skipped = r.skipped ?? [];
  const treatMissing = !!settings.data?.treatMissingAttendanceAsAbsent;

  const onRecompute = async () => {
    const ok = await confirm({
      title: 'Recalculate every payslip?',
      description:
        'Attendance, holidays and each person’s pay package are read again. Bonuses and deductions you added are kept.',
      confirmText: 'Recalculate',
    });
    if (ok) recompute.mutate(r._id);
  };

  const onReopen = async () => {
    const ok = await confirm({
      title: `Reopen ${title}?`,
      description:
        'It goes back to draft so you can correct payslips. People already got their payslip emails; they’ll get new ones when you finalize again. This is recorded in the audit log.',
      confirmText: 'Reopen as draft',
      destructive: true,
    });
    if (ok) reopen.mutate(r._id);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const file = `payroll-${r.month}`;
      if (isOwner(role)) {
        const bank = await payrollApi.bankExport(r._id);
        downloadCsv(
          `${file}-bank-transfer`,
          ['Name', 'Account holder', 'Account (last 4)', 'IFSC', 'Bank', 'UPI', 'Net pay (₹)'],
          bank.map((b) => [
            b.name,
            b.accountHolderName ?? 'Bank details missing',
            b.accountNumberLast4 ? `XXXX${b.accountNumberLast4}` : '',
            b.ifsc ?? '',
            b.bankName ?? '',
            b.upiId ?? '',
            csvMoney(b.netPaise),
          ]),
        );
        const missing = bank.filter((b) => !b.accountNumberLast4 && !b.upiId).length;
        if (missing) toast.warning(`${missing} ${missing === 1 ? 'person has' : 'people have'} no bank details yet`);
      } else {
        downloadCsv(
          file,
          ['Name', 'Email', 'Working days', 'Unpaid days', 'Gross (₹)', 'Deductions (₹)', 'Net pay (₹)'],
          rows.map((s) => [s.userName ?? '', s.userEmail ?? '', s.workingDays, s.lopDays, csvMoney(s.grossPaise), csvMoney(s.deductionsPaise), csvMoney(s.netPaise)]),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't export");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<PayslipRow>[] = [
    {
      id: 'person',
      header: 'Person',
      cell: (s) => (
        <div>
          <Link href={`/team/${s.userId}`} className="font-medium hover:underline">
            {s.userName ?? 'Deleted member'}
          </Link>
          {(s.projectPayments ?? []).length > 0 && (
            <div className="mt-1 space-y-0.5">
              {s.projectPayments!.map((pp, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <Link href={`/projects/${pp.projectId}`} className="hover:underline">
                    {pp.projectName || 'Deleted project'}
                  </Link>{' '}
                  · {formatPaise(pp.amountPaise, s.currency)}
                </p>
              ))}
            </div>
          )}
        </div>
      ),
      footer: <span className="text-muted-foreground">{rows.length} people</span>,
    },
    {
      id: 'days',
      header: 'Working days',
      align: 'right',
      hideBelow: 'md',
      cell: (s) => s.workingDays,
    },
    {
      id: 'lop',
      header: 'Unpaid days',
      align: 'right',
      cell: (s) => (
        <span>
          {s.lopDays > 0 ? <span className="text-destructive">{s.lopDays}</span> : <span className="text-muted-foreground">0</span>}
          {(s.unmarkedDays ?? 0) > 0 && !treatMissing && (
            <span className="block text-[11px] text-muted-foreground">{s.unmarkedDays} not marked</span>
          )}
        </span>
      ),
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) => formatPaise(s.grossPaise, s.currency),
      footer: formatPaise(totals.gross),
    },
    {
      id: 'deductions',
      header: 'Deductions',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) => (s.deductionsPaise ? <span className="text-destructive">−{formatPaise(s.deductionsPaise, s.currency)}</span> : '—'),
      footer: totals.deductions ? `−${formatPaise(totals.deductions)}` : '—',
    },
    {
      id: 'net',
      header: 'Net pay',
      align: 'right',
      cell: (s) => (
        <span className="font-semibold">
          {formatPaise(s.netPaise, s.currency)}
          {s.adjustments.length > 0 && (
            <span className="block text-[11px] font-normal text-muted-foreground">
              {s.adjustments.length} adjustment{s.adjustments.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
      ),
      footer: <span className="font-semibold">{formatPaise(totals.net)}</span>,
    },
    {
      id: 'pdf',
      header: '',
      align: 'right',
      cell: (s) => (
        <a
          href={`${env.apiBaseUrl}/payroll/payslips/${s._id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          PDF
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        crumbs={[{ label: 'Payroll', href: '/payroll' }]}
        meta={
          <>
            <StatusBadge status={r.status} />
            {legacy && <Badge variant="muted">Legacy project payouts</Badge>}
          </>
        }
        description={
          r.status === PayrollStatus.PAID
            ? `Paid ${r.paidAt ? formatDate(r.paidAt) : ''}`
            : r.status === PayrollStatus.FINALIZED
              ? `Finalized ${r.finalizedAt ? formatDate(r.finalizedAt) : ''} — payslips sent, waiting to be marked paid`
              : `Draft${r.computedAt ? ` · calculated ${formatDate(r.computedAt)}` : ''} — review, then finalize to send payslips`
        }
        action={
          <>
            <Button variant="outline" size="sm" disabled={!rows.length || exporting} onClick={() => void exportCsv()}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> {exporting ? 'Exporting…' : isOwner(role) ? 'Bank transfer CSV' : 'Export CSV'}
            </Button>
            {editable && (
              <>
                <Button variant="outline" size="sm" disabled={recompute.isPending} onClick={() => void onRecompute()}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${recompute.isPending ? 'animate-spin' : ''}`} />
                  {recompute.isPending ? 'Recalculating…' : 'Recalculate'}
                </Button>
                <Button size="sm" disabled={!rows.length} onClick={() => setReviewOpen(true)}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Review & finalize
                </Button>
              </>
            )}
            {r.status === PayrollStatus.FINALIZED && (
              <>
                {isOwner(role) && (
                  <Button variant="outline" size="sm" disabled={reopen.isPending} onClick={() => void onReopen()}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reopen
                  </Button>
                )}
                <Button size="sm" onClick={() => setPaidOpen(true)}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark as paid
                </Button>
              </>
            )}
          </>
        }
      />

      {legacy && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This run was created automatically from project payments by an older version of the app. Project payments now live in{' '}
          <Link href="/payments" className="text-primary hover:underline">
            Payments
          </Link>
          .
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People paid" loading={slips.isLoading} value={String(rows.length)} hint={skipped.length ? `${skipped.length} left out` : 'Everyone included'} />
        <StatCard label="Total net pay" loading={slips.isLoading} value={formatPaise(totals.net)} hint={`Gross ${formatPaise(totals.gross)}`} />
        <StatCard
          label="Deductions"
          loading={slips.isLoading}
          value={formatPaise(totals.deductions)}
          hint={totals.manualDeductions ? `incl. ${formatPaise(totals.manualDeductions)} manual` : undefined}
        />
        <StatCard
          label="Unpaid days"
          loading={slips.isLoading}
          value={String(Math.round(totals.lop * 10) / 10)}
          tone={totals.lop ? 'warning' : 'default'}
          hint={totals.unmarked && !treatMissing ? `${totals.unmarked} unmarked days were paid` : undefined}
        />
      </div>

      {skipped.length > 0 && <SkippedCard run={r} canSetPay={isOwner(role)} />}

      {editable && (
        <p className="text-xs text-muted-foreground">
          Only days marked absent count as unpaid
          {treatMissing ? ', and so do working days with no attendance record' : '; days with no attendance record are paid'}. Future days are never
          counted.{' '}
          <Link href="/settings/general" className="text-primary hover:underline">
            Change in settings
          </Link>
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s._id}
        loading={slips.isLoading}
        error={slips.error}
        onRetry={() => slips.refetch()}
        onRowClick={(s) => setSelectedId(s._id)}
        showFooter={rows.length > 0}
        empty={
          <EmptyState
            icon={Users}
            title="No payslips in this run"
            description={
              skipped.length
                ? 'Everyone was left out — see the list above. Set up their pay, then recalculate.'
                : 'Nobody on the team can be paid this month yet. Set up pay packages from each person’s compensation page.'
            }
            action={
              <Link href="/team">
                <Button variant="outline" size="sm">Go to team</Button>
              </Link>
            }
          />
        }
      />

      <PayslipSheet slip={selected} editable={editable} onOpenChange={(o) => !o && setSelectedId(undefined)} />
      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} run={r} rows={rows} totals={totals} treatMissing={treatMissing} />
      <MarkPaidDialog open={paidOpen} onOpenChange={setPaidOpen} run={r} />
    </div>
  );
}

function SkippedCard({ run, canSetPay }: { run: PayrollRunRow; canSetPay: boolean }) {
  const skipped = run.skipped ?? [];
  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Left out of this run ({skipped.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {skipped.map((p) => (
            <li key={p.userId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <Link href={`/team/${p.userId}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="text-muted-foreground"> · {PAYROLL_SKIP_REASON_LABEL[p.reason] ?? p.reason}</span>
              </span>
              {p.reason === PayrollSkipReason.NO_COMPENSATION &&
                (canSetPay ? (
                  <Link href={`/team/${p.userId}/compensation`} className="text-sm text-primary hover:underline">
                    Set up pay
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Ask the owner to set up their pay</span>
                ))}
            </li>
          ))}
        </ul>
        {run.status === PayrollStatus.DRAFT && (
          <p className="mt-2 text-xs text-muted-foreground">After fixing this, use Recalculate to add them.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  run,
  rows,
  totals,
  treatMissing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run: PayrollRunRow;
  rows: PayslipRow[];
  totals: { gross: number; deductions: number; net: number; lop: number; unmarked: number; bonuses: number; manualDeductions: number };
  treatMissing: boolean;
}) {
  const finalize = useFinalizePayrollRun();
  const confirm = useConfirm();
  const month = monthTitle(run.month);
  const zeroNet = rows.filter((s) => s.netPaise === 0);
  const checks: { ok: boolean; text: string }[] = [
    { ok: (run.skipped ?? []).length === 0, text: (run.skipped ?? []).length ? `${run.skipped!.length} people are left out (no pay package or project-based)` : 'Everyone who can be paid is included' },
    { ok: zeroNet.length === 0, text: zeroNet.length ? `${zeroNet.length} payslip${zeroNet.length === 1 ? ' has' : 's have'} ₹0 net pay` : 'No ₹0 payslips' },
    {
      ok: treatMissing || totals.unmarked === 0,
      text:
        totals.unmarked && !treatMissing
          ? `${totals.unmarked} working day${totals.unmarked === 1 ? '' : 's'} had no attendance record and were paid`
          : 'Attendance is complete',
    },
  ];

  const go = async () => {
    const ok = await confirm({
      title: `Finalize ${month} payroll?`,
      description: `Finalize ${month} payroll for ${rows.length} ${rows.length === 1 ? 'person' : 'people'}, ${formatPaise(totals.net)} total? Payslips are emailed and amounts lock.`,
      confirmText: 'Finalize and send',
    });
    if (!ok) return;
    finalize.mutate({ id: run._id, body: {} }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !finalize.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review {month} payroll</DialogTitle>
          <DialogDescription>Check the numbers before payslips go out. After finalizing, only the owner can reopen the run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">People</p>
              <p className="font-semibold">{rows.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total net pay</p>
              <p className="font-semibold tabular-nums">{formatPaise(totals.net)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross</p>
              <p className="tabular-nums">{formatPaise(totals.gross)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deductions</p>
              <p className="tabular-nums">{formatPaise(totals.deductions)}</p>
            </div>
            {(totals.bonuses > 0 || totals.manualDeductions > 0) && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Includes {formatPaise(totals.bonuses)} in bonuses and {formatPaise(totals.manualDeductions)} in manual deductions.
              </div>
            )}
          </div>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className={c.ok ? 'text-muted-foreground' : ''}>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={finalize.isPending}>
            Keep editing
          </Button>
          <Button onClick={() => void go()} disabled={finalize.isPending || rows.length === 0}>
            {finalize.isPending ? 'Finalizing…' : 'Finalize'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidDialog({ open, onOpenChange, run }: { open: boolean; onOpenChange: (o: boolean) => void; run: PayrollRunRow }) {
  const markPaid = useMarkPayrollPaid();
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string>();
  const submit = () => {
    if (!date) return setError('Pick the day the money went out');
    if (date > todayLocal()) return setError('The payment date can’t be in the future');
    setError(undefined);
    markPaid.mutate({ id: run._id, paidAt: date }, { onSuccess: () => onOpenChange(false) });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setDate(todayLocal());
          setError(undefined);
        }
        if (!markPaid.isPending) onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark {monthTitle(run.month)} payroll as paid</DialogTitle>
          <DialogDescription>
            Record that {formatPaise(run.totalNetPaise)} went out to {run.employeeCount} {run.employeeCount === 1 ? 'person' : 'people'}. The run can’t be reopened after this.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField label="Paid on" required error={error}>
            <Input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Saving…' : 'Mark as paid'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
