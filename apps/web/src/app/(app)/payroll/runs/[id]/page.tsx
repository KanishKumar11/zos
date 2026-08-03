// Payroll run detail — payslip table.
'use client';

import { Fragment, use, useState } from 'react';
import { useForm } from 'react-hook-form';

import { PayrollStatus, type PayslipAdjustmentInput, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import {
  useAddPayslipAdjustment,
  usePayrollRun,
  useRemovePayslipAdjustment,
  useRunPayslips,
  type PayslipRow,
} from '@/features/payroll/payroll.hooks';
import { useTeamList } from '@/features/team/team.hooks';

export default function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const run = usePayrollRun(id);
  const slips = useRunPayslips(id);
  const team = useTeamList({ pageSize: 100 });
  const [expanded, setExpanded] = useState<string | null>(null);

  const teamMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));
  const editable = run.data?.status !== PayrollStatus.FINALIZED;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payroll run ${run.data?.month ?? '…'}`}
        description={run.data ? `${run.data.status} · ${run.data.employeeCount} team members · ${formatPaise(run.data.totalNetPaise, 'INR')} total net` : undefined}
      />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          💡 For individual project payments and member payment tracking, view the <a href="/projects" className="text-primary hover:underline">Projects</a> section.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Working</TH>
                <TH>Present</TH>
                <TH>LOP</TH>
                <TH>Gross</TH>
                <TH>Deductions</TH>
                <TH>Net</TH>
                <TH>PDF</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {(slips.data ?? []).map((s) => {
                const isOpen = expanded === s._id;
                return (
                  <Fragment key={s._id}>
                    <TR>
                      <TD>
                        <div>
                          <a href={`/team/${s.userId}`} className="text-primary hover:underline font-medium">
                            {teamMap.get(s.userId) || s.userId}
                          </a>
                          {s.projectPayments && s.projectPayments.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {s.projectPayments.map((pp: any, i: number) => (
                                <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <a href={`/projects/${pp.projectId}`} className="hover:underline text-primary">
                                    {pp.projectName}
                                  </a>
                                  <span>— {formatPaise(pp.amountPaise, s.currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TD>
                      <TD>{s.workingDays}</TD>
                      <TD>{s.presentDays}</TD>
                      <TD>{s.lopDays}</TD>
                      <TD>{formatPaise(s.grossPaise, s.currency)}</TD>
                      <TD>{formatPaise(s.deductionsPaise, s.currency)}</TD>
                      <TD className="font-semibold">{formatPaise(s.netPaise, s.currency)}</TD>
                      <TD>
                        <a
                          href={`${env.apiBaseUrl}/payroll/payslips/${s._id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Download
                        </a>
                      </TD>
                      <TD>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : s._id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {s.adjustments.length > 0 ? `${s.adjustments.length} adj.` : 'Adjust'} {isOpen ? '▲' : '▼'}
                        </button>
                      </TD>
                    </TR>
                    {isOpen && (
                      <TR>
                        <TD colSpan={9} className="bg-muted/20">
                          <AdjustmentsPanel slip={s} editable={editable} />
                        </TD>
                      </TR>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdjustmentsPanel({ slip, editable }: { slip: PayslipRow; editable: boolean }) {
  const addAdjustment = useAddPayslipAdjustment();
  const removeAdjustment = useRemovePayslipAdjustment();
  const [adding, setAdding] = useState(false);
  const form = useForm<PayslipAdjustmentInput>({
    defaultValues: { kind: 'BONUS', reason: '', amountPaise: 0 },
  });

  const onSubmit = form.handleSubmit((values) =>
    addAdjustment.mutate(
      { payslipId: slip._id, body: values },
      { onSuccess: () => { setAdding(false); form.reset({ kind: 'BONUS', reason: '', amountPaise: 0 }); } },
    ),
  );

  return (
    <div className="space-y-2 p-2">
      {slip.adjustments.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No manual adjustments on this payslip.</p>
      )}
      {slip.adjustments.map((a, idx) => (
        <div key={idx} className="flex items-center justify-between text-xs">
          <span className={a.kind === 'BONUS' ? 'text-emerald-600' : 'text-destructive'}>
            {a.kind} — {a.reason}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-medium">
              {a.kind === 'DEDUCTION' ? '−' : '+'}{formatPaise(a.amountPaise, slip.currency)}
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => removeAdjustment.mutate({ payslipId: slip._id, idx })}
                className="text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
      {editable && (
        adding ? (
          <form onSubmit={onSubmit} className="grid grid-cols-[100px_1fr_120px_auto] gap-2 items-end pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-[10px]">Kind</Label>
              <select className="h-8 w-full rounded border bg-background px-2 text-xs" {...form.register('kind')}>
                <option value="BONUS">Bonus</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Reason</Label>
              <Input className="h-8 text-xs" {...form.register('reason', { required: true })} placeholder="e.g. Diwali bonus" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Amount (paise)</Label>
              <Input type="number" className="h-8 text-xs" {...form.register('amountPaise', { required: true, valueAsNumber: true })} />
            </div>
            <div className="flex gap-1">
              <Button type="submit" size="sm" disabled={addAdjustment.isPending}>
                {addAdjustment.isPending ? 'Saving…' : 'Add'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-primary hover:underline">
            + Add bonus/deduction
          </button>
        )
      )}
      {!editable && (
        <p className="text-xs text-muted-foreground">Run is finalized — adjustments are locked.</p>
      )}
    </div>
  );
}
