// Payroll run detail — payslip table.
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';

import { usePayrollRun, useRunPayslips } from '@/features/payroll/payroll.hooks';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll run {run.data?.month}</h1>
        <p className="text-sm text-muted-foreground">
          Status: {run.data?.status} · {run.data?.employeeCount} employees ·{' '}
          {run.data && formatPaise(run.data.totalNetPaise, 'INR')} total net
        </p>
      </div>

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
              </TR>
            </THead>
            <TBody>
              {(slips.data ?? []).map((s) => (
                <TR key={s._id}>
                  <TD>{s.userId}</TD>
                  <TD>{s.workingDays}</TD>
                  <TD>{s.presentDays}</TD>
                  <TD>{s.lopDays}</TD>
                  <TD>{formatPaise(s.grossPaise, s.currency)}</TD>
                  <TD>{formatPaise(s.deductionsPaise, s.currency)}</TD>
                  <TD className="font-semibold">{formatPaise(s.netPaise, s.currency)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
