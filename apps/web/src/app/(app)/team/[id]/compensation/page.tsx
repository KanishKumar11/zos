// Compensation for one team member — OWNER only. Amounts are typed in rupees (stored in paise),
// with a live monthly cost / take-home preview. A future "effective from" schedules the change.
'use client';

import { CalendarClock } from 'lucide-react';
import { use, useEffect, useMemo, useState } from 'react';

import { CompensationType, Role, type UpsertCompensationInput } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { toLocalDateInput, todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import {
  useCompensation,
  useCompensationHistory,
  useUpsertCompensation,
  type CompensationHistoryRow,
  type CompensationProfileRow,
} from '@/features/compensation/compensation.hooks';
import { useTeamMember } from '@/features/team/team.hooks';

const TYPE_LABEL: Record<CompensationType, string> = {
  FIXED_MONTHLY: 'Monthly salary',
  STIPEND: 'Stipend',
  PROJECT_BASED: 'Paid per project',
};
const TYPE_HINT: Record<CompensationType, string> = {
  FIXED_MONTHLY: 'Included in monthly payroll.',
  STIPEND: 'Included in monthly payroll, usually without PF or tax.',
  PROJECT_BASED: 'Not on payroll — pay them per project from Payments.',
};

const MONEY_FIELDS = [
  { key: 'baseAmount', label: 'Basic pay', hint: 'Monthly. Loss of pay is worked out on this.' },
  { key: 'hra', label: 'HRA', hint: 'House rent allowance, monthly.' },
  { key: 'specialAllowance', label: 'Special allowance', hint: 'Monthly.' },
  { key: 'providentFundEmployee', label: 'PF (employee share)', hint: 'Deducted from pay.' },
  { key: 'providentFundEmployer', label: 'PF (employer share)', hint: 'Paid by you, on top of pay.' },
  { key: 'professionalTax', label: 'Professional tax', hint: 'Deducted monthly.' },
  { key: 'tdsMonthly', label: 'TDS', hint: 'Income tax deducted monthly.' },
] as const;
type MoneyKey = (typeof MONEY_FIELDS)[number]['key'];

interface Values {
  type: CompensationType;
  amounts: Record<MoneyKey, number | undefined>;
  effectiveFrom: string;
  reason: string;
}

const fromProfile = (p: CompensationProfileRow | null | undefined): Values => ({
  type: p?.type ?? CompensationType.FIXED_MONTHLY,
  amounts: {
    baseAmount: p?.baseAmount,
    hra: p?.hra ?? 0,
    specialAllowance: p?.specialAllowance ?? 0,
    providentFundEmployee: p?.providentFundEmployee ?? 0,
    providentFundEmployer: p?.providentFundEmployer ?? 0,
    professionalTax: p?.professionalTax ?? 0,
    tdsMonthly: p?.tdsMonthly ?? 0,
  },
  effectiveFrom: todayLocal(),
  reason: '',
});

const monthlyFigures = (a: Partial<Record<MoneyKey, number | undefined>>) => {
  const n = (k: MoneyKey) => a[k] ?? 0;
  const gross = n('baseAmount') + n('hra') + n('specialAllowance');
  const ctc = gross + n('providentFundEmployer');
  const net = Math.max(0, gross - n('providentFundEmployee') - n('professionalTax') - n('tdsMonthly'));
  return { gross, ctc, net };
};

export default function MemberCompensationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState title="Only the owner can see compensation" />}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const member = useTeamMember(id);
  const comp = useCompensation(id);
  const history = useCompensationHistory(id);
  const upsert = useUpsertCompensation();
  const [v, setV] = useState<Values>(() => fromProfile(undefined));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (comp.isSuccess) setV(fromProfile(comp.data));
  }, [comp.isSuccess, comp.data]);

  const figures = monthlyFigures(v.amounts);
  const today = todayLocal();
  const scheduled = v.effectiveFrom > today;
  const currentFrom = comp.data?.effectiveFrom ? toLocalDateInput(comp.data.effectiveFrom) : undefined;
  const backdatedBeforeCurrent = !!currentFrom && v.effectiveFrom < currentFrom;
  const projectBased = v.type === CompensationType.PROJECT_BASED;

  const scheduledRows = useMemo(
    () => (history.data ?? []).filter((h) => toLocalDateInput(h.effectiveFrom) > today),
    [history.data, today],
  );
  // History is newest-first; the first row whose date has arrived is the package in force.
  const currentRowId = useMemo(
    () => (history.data ?? []).find((h) => toLocalDateInput(h.effectiveFrom) <= today)?._id,
    [history.data, today],
  );

  if (member.isLoading || comp.isLoading) return <PageSkeleton />;
  if (member.isError || !member.data)
    return <ErrorState title="Couldn't open this person" error={member.error} onRetry={() => member.refetch()} />;
  if (comp.isError) return <ErrorState title="Couldn't load compensation" error={comp.error} onRetry={() => comp.refetch()} />;

  const name = member.data.name;
  const setAmount = (k: MoneyKey, paise: number | undefined) => {
    setV((p) => ({ ...p, amounts: { ...p.amounts, [k]: paise } }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!projectBased && !v.amounts.baseAmount) e.baseAmount = 'Enter the monthly basic pay';
    if (!v.effectiveFrom) e.effectiveFrom = 'Pick the date this pay starts';
    if (!projectBased && figures.net === 0 && figures.gross > 0) e.tdsMonthly = 'Deductions are more than the pay';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: UpsertCompensationInput = {
      type: v.type,
      currency: comp.data?.currency ?? 'INR',
      baseAmount: projectBased ? 0 : (v.amounts.baseAmount ?? 0),
      hra: projectBased ? 0 : (v.amounts.hra ?? 0),
      specialAllowance: projectBased ? 0 : (v.amounts.specialAllowance ?? 0),
      providentFundEmployee: projectBased ? 0 : (v.amounts.providentFundEmployee ?? 0),
      providentFundEmployer: projectBased ? 0 : (v.amounts.providentFundEmployer ?? 0),
      professionalTax: projectBased ? 0 : (v.amounts.professionalTax ?? 0),
      tdsMonthly: projectBased ? 0 : (v.amounts.tdsMonthly ?? 0),
      effectiveFrom: v.effectiveFrom as unknown as Date,
      reason: v.reason.trim() || undefined,
    };
    setServerError(undefined);
    try {
      await upsert.mutateAsync({ userId: id, body, scheduled });
      setV((p) => ({ ...p, reason: '' }));
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compensation"
        crumbs={[
          { label: 'Team', href: '/team' },
          { label: name, href: `/team/${id}` },
        ]}
        description={`Pay package for ${name}. Only you (the owner) can see this.`}
        meta={comp.data ? <Badge variant="outline">{TYPE_LABEL[comp.data.type]}</Badge> : <Badge variant="warning">Not set</Badge>}
      />

      {!comp.data && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          No pay package yet{scheduledRows.length ? ' that applies today' : ''}. {name} is left out of payroll until one is set.
        </div>
      )}

      {scheduledRows.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-600/30 bg-sky-600/5 px-4 py-3 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" />
          <div>
            {scheduledRows.map((h) => (
              <p key={h._id}>
                Scheduled: {formatPaise(monthlyFigures(h).gross, h.currency)} a month from {formatDate(h.effectiveFrom)}
                {h.reason ? ` — ${h.reason}` : ''}
              </p>
            ))}
            <p className="text-muted-foreground">Payroll uses the package that applies in each month.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>{comp.data ? 'Change package' : 'Set package'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
              <FormField label="How they are paid" hint={TYPE_HINT[v.type]} error={errors.type}>
                <Select value={v.type} onChange={(e) => setV((p) => ({ ...p, type: e.target.value as CompensationType }))}>
                  {Object.values(CompensationType).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </FormField>

              {!projectBased && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {MONEY_FIELDS.map((f) => (
                    <FormField key={f.key} label={f.label} required={f.key === 'baseAmount'} hint={f.hint} error={errors[f.key]}>
                      <MoneyInput
                        value={v.amounts[f.key]}
                        onChange={(paise) => setAmount(f.key, paise)}
                        invalid={!!errors[f.key]}
                        placeholder="0"
                      />
                    </FormField>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Effective from"
                  required
                  error={errors.effectiveFrom}
                  hint={
                    scheduled
                      ? `Scheduled — the current package stays until ${formatDate(v.effectiveFrom)}.`
                      : backdatedBeforeCurrent
                        ? `Earlier than the current package (from ${formatDate(currentFrom!)}), so it only affects payroll before then.`
                        : 'Payroll from this month uses the new amounts.'
                  }
                >
                  <Input type="date" value={v.effectiveFrom} onChange={(e) => setV((p) => ({ ...p, effectiveFrom: e.target.value }))} />
                </FormField>
                <FormField label="Reason" hint="Optional, e.g. annual raise" error={errors.reason}>
                  <Input value={v.reason} maxLength={500} onChange={(e) => setV((p) => ({ ...p, reason: e.target.value }))} />
                </FormField>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setV(fromProfile(comp.data))} disabled={upsert.isPending}>
                  Reset
                </Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending ? 'Saving…' : scheduled ? 'Schedule change' : 'Save package'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Monthly preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {projectBased ? (
              <p className="text-muted-foreground">Paid per project — nothing is added to payroll.</p>
            ) : (
              <>
                <Row label="Gross pay" value={formatPaise(figures.gross)} />
                <Row label="Cost to company" value={formatPaise(figures.ctc)} hint={`${formatPaise(figures.ctc * 12)} a year`} />
                <div className="border-t pt-3">
                  <Row label="Estimated take-home" value={formatPaise(figures.net)} strong />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Before loss of pay, bonuses and one-off deductions on each payslip.
                  </p>
                </div>
                {comp.data && (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Now: {formatPaise(monthlyFigures(comp.data).gross)} gross a month, since {formatDate(comp.data.effectiveFrom)}.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} className="py-6" />
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(history.data ?? []).map((h) => (
                <HistoryRow key={h._id} row={h} today={today} isCurrent={h._id === currentRowId} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryRow({ row, today, isCurrent }: { row: CompensationHistoryRow; today: string; isCurrent: boolean }) {
  const from = toLocalDateInput(row.effectiveFrom);
  const f = monthlyFigures(row);
  return (
    <li className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">
          {row.type === CompensationType.PROJECT_BASED ? 'Paid per project' : `${formatPaise(f.gross, row.currency)} a month`}
          <span className="font-normal text-muted-foreground"> · {TYPE_LABEL[row.type]}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          From {formatDate(row.effectiveFrom)} · saved {formatDate(row.createdAt)}
          {row.reason ? ` · ${row.reason}` : ''}
        </p>
      </div>
      {from > today ? <Badge variant="info">Scheduled</Badge> : isCurrent ? <Badge variant="success">Current</Badge> : null}
    </li>
  );
}

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className={strong ? 'text-base font-semibold tabular-nums' : 'font-medium tabular-nums'}>{value}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}
