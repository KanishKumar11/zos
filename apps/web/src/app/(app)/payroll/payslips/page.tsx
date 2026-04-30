// My payslips — accessible to every employee.
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';

import { useMyPayslips } from '@/features/payroll/payroll.hooks';

export default function MyPayslipsPage() {
  const slips = useMyPayslips();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My payslips</h1>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {slips.data && slips.data.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Month</TH>
                  <TH>Working</TH>
                  <TH>Present</TH>
                  <TH>Gross</TH>
                  <TH>Deductions</TH>
                  <TH>Net</TH>
                </TR>
              </THead>
              <TBody>
                {slips.data.map((s) => (
                  <TR key={s._id}>
                    <TD>{s.month}</TD>
                    <TD>{s.workingDays}</TD>
                    <TD>{s.presentDays}</TD>
                    <TD>{formatPaise(s.grossPaise, s.currency)}</TD>
                    <TD>{formatPaise(s.deductionsPaise, s.currency)}</TD>
                    <TD className="font-semibold">{formatPaise(s.netPaise, s.currency)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No payslips yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
