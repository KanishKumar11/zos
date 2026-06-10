// Payroll run detail — payslip table.
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { usePayrollRun, useRunPayslips } from '@/features/payroll/payroll.hooks';
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

  const teamMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payroll run ${run.data?.month ?? '…'}`}
        description={run.data ? `${run.data.status} · ${run.data.employeeCount} team members · ${formatPaise(run.data.totalNetPaise, 'INR')} total net` : undefined}
      />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          💡 For individual project payments and member payment tracking, view the <a href="/projects" className="text-blue-600 hover:underline">Projects</a> section.
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
              </TR>
            </THead>
            <TBody>
              {(slips.data ?? []).map((s) => (
                <TR key={s._id}>
                  <TD>
                    <div>
                      <a href={`/team/${s.userId}`} className="text-blue-600 hover:underline font-medium">
                        {teamMap.get(s.userId) || s.userId}
                      </a>
                      {s.projectPayments && s.projectPayments.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {s.projectPayments.map((pp: any, i: number) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <a href={`/projects/${pp.projectId}`} className="hover:underline text-blue-500">
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
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
