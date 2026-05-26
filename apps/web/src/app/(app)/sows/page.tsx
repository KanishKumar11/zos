// SOW list page (OWNER-only).
'use client';

import Link from 'next/link';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useSows } from '@/features/sow/sow.hooks';

export default function SowsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowsInner />
    </RoleGate>
  );
}

function SowsInner() {
  const list = useSows();
  return (
    <div className="space-y-6">
      <PageHeader title="Statements of Work" description="Client SOWs and milestone tracking." />
      <Card>
        <CardHeader>
          <CardTitle>All SOWs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Client</TH>
                <TH>Value</TH>
                <TH>Milestones</TH>
                <TH>Signed</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((s) => (
                <TR key={s._id}>
                  <TD>
                    <Link className="underline" href={`/sows/${s._id}`}>
                      {s.title}
                    </Link>
                  </TD>
                  <TD>{s.clientId.slice(-6)}</TD>
                  <TD>{formatPaise(s.totalValuePaise, s.currency)}</TD>
                  <TD>{s.milestones.length}</TD>
                  <TD>{s.signedAt ? new Date(s.signedAt).toLocaleDateString() : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
