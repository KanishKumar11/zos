// Client detail (OWNER-only).
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import { useClient } from '@/features/clients/clients.hooks';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const c = useClient(id);
  if (c.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!c.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const client = c.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="text-sm text-muted-foreground">{client.gstin || 'No GSTIN'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{client.address || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Role</TH>
              </TR>
            </THead>
            <TBody>
              {client.contacts.map((cc, i) => (
                <TR key={i}>
                  <TD>{cc.name}</TD>
                  <TD>{cc.email ?? '—'}</TD>
                  <TD>{cc.phone ?? '—'}</TD>
                  <TD>{cc.role ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{client.notes || '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
