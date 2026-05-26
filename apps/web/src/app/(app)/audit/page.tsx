// Audit list page (OWNER + ADMIN).
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AuditAction, Role } from '@agency/shared';

import { PageHeader } from '@/components/layout/page-header';
import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, unwrap } from '@/lib/api-client';

interface AuditRow {
  _id: string;
  actorId?: string;
  entity: string;
  entityId?: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  createdAt: string;
}
interface PageData {
  items: AuditRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default function AuditPage() {
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [entity, setEntity] = useState('');
  const list = useQuery({
    queryKey: ['audit', { entity }],
    queryFn: () =>
      unwrap<PageData>(
        api.get('/audit', { params: { page: 1, limit: 100, entity: entity || undefined } }),
      ),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="All workspace activity, immutable." />
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter by entity (e.g., Project)"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="max-w-sm"
          />
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Id</TH>
                <TH>IP</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data?.items ?? []).map((r) => (
                <TR key={r._id}>
                  <TD>{new Date(r.createdAt).toLocaleString()}</TD>
                  <TD>{r.actorId ? r.actorId.slice(-6) : '—'}</TD>
                  <TD>{r.action}</TD>
                  <TD>{r.entity}</TD>
                  <TD>{r.entityId ?? '—'}</TD>
                  <TD>{r.ipAddress ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
