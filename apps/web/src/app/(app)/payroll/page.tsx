// Payroll runs page — OWNER+ADMIN.
'use client';

import { useState } from 'react';

import { PayrollStatus, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { PageHeader } from '@/components/layout/page-header';

import {
  useCreatePayrollRun,
  useFinalizePayrollRun,
  usePayrollRuns,
  useRecomputePayrollRun,
} from '@/features/payroll/payroll.hooks';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function PayrollPage() {
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const runs = usePayrollRuns();
  const create = useCreatePayrollRun();
  const recompute = useRecomputePayrollRun();
  const finalize = useFinalizePayrollRun();
  const [month, setMonth] = useState(monthKey(new Date()));

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Manage monthly payroll runs." />

      <Card>
        <CardHeader>
          <CardTitle>New run</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button onClick={() => create.mutate({ month })} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create draft'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH>Status</TH>
                <TH>Employees</TH>
                <TH>Total net</TH>
                <TH>Finalized</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {(runs.data ?? []).map((r) => (
                <TR key={r._id}>
                  <TD>{r.month}</TD>
                  <TD>{r.status}</TD>
                  <TD>{r.employeeCount}</TD>
                  <TD>{formatPaise(r.totalNetPaise, 'INR')}</TD>
                  <TD>{r.finalizedAt ? new Date(r.finalizedAt).toLocaleString() : '—'}</TD>
                  <TD className="space-x-1">
                    {r.status === PayrollStatus.DRAFT && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => recompute.mutate(r._id)}>
                          Recompute
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => finalize.mutate({ id: r._id, body: {} })}
                        >
                          Finalize
                        </Button>
                      </>
                    )}
                    <a className="text-sm underline" href={`/payroll/runs/${r._id}`}>
                      View
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
