// Project detail.
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { useProject } from '@/features/projects/projects.hooks';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;

  if (project.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const p = project.data;

  return (
    <div className="space-y-6">
      <PageHeader title={p.name} description={`${p.code} · ${p.status}`} />

      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{p.brief || 'No brief recorded.'}</p>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Client budget</p>
              <p className="text-lg font-semibold">
                {formatPaise(p.clientBudgetPaise ?? 0, p.currency ?? 'INR')}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Agency margin</p>
              <p className="text-lg font-semibold">
                {formatPaise(p.agencyMarginPaise ?? 0, p.currency ?? 'INR')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members ({p.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Added</TH>
              </TR>
            </THead>
            <TBody>
              {p.members.map((m) => (
                <TR key={m.userId}>
                  <TD>{m.userId}</TD>
                  <TD>{m.role}</TD>
                  <TD>{new Date(m.addedAt).toLocaleDateString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
