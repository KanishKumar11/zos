// SOW detail (OWNER-only).
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';

import { useSow } from '@/features/sow/sow.hooks';

export default function SowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowDetailInner id={id} />
    </RoleGate>
  );
}

function SowDetailInner({ id }: { id: string }) {
  const sow = useSow(id);
  if (sow.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!sow.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const s = sow.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatPaise(s.totalValuePaise, s.currency)} · {s.milestones.length} milestones
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{s.description || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Amount</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {s.milestones.map((m, i) => (
                <TR key={i}>
                  <TD>{m.title}</TD>
                  <TD>{formatPaise(m.amountPaise, s.currency)}</TD>
                  <TD>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}</TD>
                  <TD>{m.status}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
