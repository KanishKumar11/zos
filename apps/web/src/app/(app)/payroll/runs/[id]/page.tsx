// Payroll run — payslips, people left out, review → finalize → mark paid, reopen (owner), CSV export.
'use client';

import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';

import { PAYROLL_SKIP_REASON_LABEL, PayrollSkipReason, PayrollStatus, Role } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { env } from '@/lib/env';
import { todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, Bento, BigNumber, Price, PrivacyChip, Tile, useCanSeePrices } from '@/components/viz';
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
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState illustration="people" title="Payroll is only for the owner" />}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const canSee = useCanSeePrices();
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
    return (
      <div className="space-y-5">
        <PageHeader title={missing ? 'Payroll run not found' : 'Payroll run'} crumbs={[{ label: 'Payroll', href: '/payroll' }]} />
        {missing ? (
          <EmptyState
            illustration="files"
            title="This payroll run no longer exists"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/payroll">Back to payroll</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState title="Couldn't open this payroll run" error={run.error} onRetry={() => run.refetch()} />
        )}
      </div>
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

  const exportCsv = async (kind: 'bank' | 'payslips') => {
    if (!canSee) return;
    setExporting(true);
    try {
      const file = `payroll-${r.month}`;
      if (kind === 'bank') {
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
          rows.map((s) => [s.userName ?? 'Deleted member', s.userEmail ?? '', s.workingDays, s.lopDays, csvMoney(s.grossPaise), csvMoney(s.deductionsPaise), csvMoney(s.netPaise)]),
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
        <div className="flex min-w-0 items-start gap-2.5">
          <Avatar id={s.userId} name={s.userName ?? 'Deleted member'} size="sm" className="mt-0.5" />
          <div className="min-w-0">
            {s.userName ? (
              <Link href={`/team/${s.userId}`} className="font-medium hover:underline">
                {s.userName}
              </Link>
            ) : (
              <span className="italic text-muted-foreground">Deleted member</span>
            )}
            {s.userEmail && <p className="hidden truncate text-xs text-muted-foreground lg:block">{s.userEmail}</p>}
            {(s.projectPayments ?? []).length > 0 && (
              <div className="mt-1 space-y-0.5">
                {s.projectPayments!.map((pp, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {pp.projectName ? (
                      <Link href={`/projects/${pp.projectId}`} className="hover:underline">
                        {pp.projectName}
                      </Link>
                    ) : (
                      <span className="italic">Deleted project</span>
                    )}{' '}
                    · <Price paise={pp.amountPaise} currency={s.currency} />
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
      footer: <span className="text-muted-foreground">{rows.length === 1 ? '1 person' : `${rows.length} people`}</span>,
    },
    {
      id: 'days',
      header: 'Working days',
      align: 'right',
      hideBelow: 'md',
      cell: (s) => <span className="font-figures">{s.workingDays}</span>,
    },
    {
      id: 'lop',
      header: 'Unpaid days',
      align: 'right',
      cell: (s) => (
        <span className="font-figures">
          {s.lopDays > 0 ? <span className="text-destructive">{s.lopDays}</span> : <span className="text-muted-foreground">0</span>}
          {(s.unmarkedDays ?? 0) > 0 && !treatMissing && <span className="block font-sans text-[11px] text-muted-foreground">{s.unmarkedDays} not marked</span>}
        </span>
      ),
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) => <Price paise={s.grossPaise} currency={s.currency} />,
      footer: <Price paise={totals.gross} />,
    },
    {
      id: 'deductions',
      header: 'Deductions',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) =>
        s.deductionsPaise ? (
          <span className="text-destructive">
            −<Price paise={s.deductionsPaise} currency={s.currency} />
          </span>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
      footer: totals.deductions ? (
        <span className="text-destructive">
          −<Price paise={totals.deductions} />
        </span>
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
    {
      id: 'net',
      header: 'Net pay',
      align: 'right',
      cell: (s) => (
        <span className="font-semibold">
          <Price paise={s.netPaise} currency={s.currency} />
          {s.adjustments.length > 0 && (
            <span className="block text-[11px] font-normal text-muted-foreground">
              {s.adjustments.length} adjustment{s.adjustments.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
      ),
      footer: <Price paise={totals.net} className="font-semibold" />,
    },
    {
      id: 'pdf',
      header: '',
      align: 'right',
      cell: (s) => (
        <a href={`${env.apiBaseUrl}/payroll/payslips/${s._id}/pdf`} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-ink hover:underline">
          PDF
        </a>
      ),
    },
  ];

  const lop = Math.round(totals.lop * 10) / 10;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        eyebrow={`Payroll · ${rows.length === 1 ? '1 person' : `${rows.length} people`}`}
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
            <Button variant="outline" size="sm" disabled={!rows.length || exporting || !canSee} onClick={() => void exportCsv('bank')}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> {exporting ? 'Exporting…' : 'Bank transfer CSV'}
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length || exporting || !canSee} onClick={() => void exportCsv('payslips')}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Payslips CSV
            </Button>
            {editable && (
              <>
                <Button variant="outline" size="sm" disabled={recompute.isPending} onClick={() => void onRecompute()}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${recompute.isPending ? 'animate-spin' : ''}`} />
                  {recompute.isPending ? 'Recalculating…' : 'Recalculate'}
                </Button>
                <Button size="sm" variant="brand" disabled={!rows.length} onClick={() => setReviewOpen(true)}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Review & finalize
                </Button>
              </>
            )}
            {r.status === PayrollStatus.FINALIZED && (
              <>
                <Button variant="outline" size="sm" disabled={reopen.isPending} onClick={() => void onReopen()}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reopen
                </Button>
                <Button size="sm" variant="brand" onClick={() => setPaidOpen(true)}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark as paid
                </Button>
              </>
            )}
          </>
        }
      />

      {legacy && (
        <div className="rounded-[var(--radius)] border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This run was created automatically from project payments by an older version of the app. Project payments now live in{' '}
          <Link href="/payments" className="font-medium text-brand-ink hover:underline">
            Payments
          </Link>
          .
        </div>
      )}

      <div className="flex justify-end">
        <PrivacyChip>Only you see these figures</PrivacyChip>
      </div>

      {slips.isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : (
        <Bento>
          <Tile span={3} title="Gross pay">
            <BigNumber caption={totals.bonuses ? <>incl. <Price paise={totals.bonuses} compact /> in bonuses</> : 'Before deductions'}>
              <Price paise={totals.gross} compact />
            </BigNumber>
          </Tile>
          <Tile span={3} title="Deductions">
            <BigNumber
              className={totals.deductions ? '[&>div]:text-destructive' : undefined}
              caption={totals.manualDeductions ? <>incl. <Price paise={totals.manualDeductions} compact /> manual</> : 'PF, tax, unpaid days and more'}
            >
              {totals.deductions ? (
                <>
                  −<Price paise={totals.deductions} compact />
                </>
              ) : (
                <Price paise={0} compact />
              )}
            </BigNumber>
          </Tile>
          <Tile span={3} tone="ink" title="Net pay">
            <BigNumber className="[&>div]:text-brand" caption={`${rows.length === 1 ? '1 person' : `${rows.length} people`}${skipped.length ? ` · ${skipped.length} left out` : ' · everyone included'}`}>
              <Price paise={totals.net} compact />
            </BigNumber>
          </Tile>
          <Tile span={3} title="Unpaid days">
            <BigNumber
              className={lop ? '[&>div]:text-warning' : undefined}
              caption={totals.unmarked && !treatMissing ? `${totals.unmarked} unmarked days were paid` : lop ? 'Days marked absent' : 'Nobody lost pay'}
            >
              <span className="font-figures">{lop}</span>
            </BigNumber>
          </Tile>
        </Bento>
      )}

      {skipped.length > 0 && <SkippedCard run={r} />}

      {editable && (
        <p className="text-xs text-muted-foreground">
          Only days marked absent count as unpaid
          {treatMissing ? ', and so do working days with no attendance record' : '; days with no attendance record are paid'}. Future days are never
          counted.{' '}
          <Link href="/settings/general" className="font-medium text-brand-ink hover:underline">
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
            illustration="people"
            title="No payslips in this run"
            description={
              skipped.length
                ? 'Everyone was left out — see the list above. Set up their pay, then recalculate.'
                : 'Nobody on the team can be paid this month yet. Set up pay packages from each person’s compensation page.'
            }
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/team">Go to team</Link>
              </Button>
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

function SkippedCard({ run }: { run: PayrollRunRow }) {
  const skipped = run.skipped ?? [];
  return (
    <Tile
      className="border-warning/40"
      title={
        <span className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" /> Left out of this run ({skipped.length})
        </span>
      }
    >
      <ul className="divide-y text-sm">
        {skipped.map((p) => (
          <li key={p.userId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar id={p.userId} name={p.name || 'Deleted member'} size="xs" />
              {p.name ? (
                <Link href={`/team/${p.userId}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
              ) : (
                <span className="italic text-muted-foreground">Deleted member</span>
              )}
              <span className="text-muted-foreground"> · {PAYROLL_SKIP_REASON_LABEL[p.reason] ?? p.reason}</span>
            </span>
            {p.reason === PayrollSkipReason.NO_COMPENSATION && (
              <Link href={`/team/${p.userId}/compensation`} className="text-sm font-medium text-brand-ink hover:underline">
                Set up pay
              </Link>
            )}
          </li>
        ))}
      </ul>
      {run.status === PayrollStatus.DRAFT && <p className="mt-2 text-xs text-muted-foreground">After fixing this, use Recalculate to add them.</p>}
    </Tile>
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
  const canSee = useCanSeePrices();
  const confirm = useConfirm();
  const month = monthTitle(run.month);
  const zeroNet = rows.filter((s) => s.netPaise === 0);
  const checks: { ok: boolean; text: string }[] = [
    { ok: (run.skipped ?? []).length === 0, text: (run.skipped ?? []).length ? `${run.skipped!.length} people are left out (no pay package or project-based)` : 'Everyone who can be paid is included' },
    { ok: zeroNet.length === 0, text: zeroNet.length ? `${zeroNet.length} payslip${zeroNet.length === 1 ? ' has' : 's have'} zero net pay` : 'No payslips with zero net pay' },
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
      description: `Finalize ${month} payroll for ${rows.length} ${rows.length === 1 ? 'person' : 'people'}${canSee ? `, ${formatPaise(totals.net)} total` : ''}? Payslips are emailed and amounts lock.`,
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
              <Price paise={totals.net} className="block font-semibold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross</p>
              <Price paise={totals.gross} className="block" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deductions</p>
              <Price paise={totals.deductions} className="block" />
            </div>
            {(totals.bonuses > 0 || totals.manualDeductions > 0) && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Includes <Price paise={totals.bonuses} /> in bonuses and <Price paise={totals.manualDeductions} /> in manual deductions.
              </div>
            )}
          </div>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
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
            Record that <Price paise={run.totalNetPaise} /> went out to {run.employeeCount} {run.employeeCount === 1 ? 'person' : 'people'}. The run can’t be reopened after this.
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
