// Project detail.
'use client';

import { use } from 'react';

import { Role } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { useProject, useProjectMemberCosts } from '@/features/projects/projects.hooks';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const costs = useProjectMemberCosts(isOwner ? id : undefined);

  if (project.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const p = project.data;

  const costsMap = new Map((costs.data ?? []).map((c) => [c.userId, c]));
  const totalDevCost = (p.clientBudgetPaise ?? 0) - (p.agencyMarginPaise ?? 0);

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
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Client budget</p>
              <p className="text-lg font-semibold">
                {formatPaise(p.clientBudgetPaise ?? 0, p.currency ?? 'INR')}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Dev cost</p>
              <p className="text-lg font-semibold text-amber-600">
                {formatPaise(totalDevCost, p.currency ?? 'INR')}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Agency margin</p>
              <p className="text-lg font-semibold text-green-600">
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
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Added</TH>
                {isOwner && <TH>Paid (project period)</TH>}
              </TR>
            </THead>
            <TBody>
              {p.members.map((m) => {
                const cost = costsMap.get(m.userId);
                return (
                  <TR key={m.userId}>
                    <TD className="font-medium">{cost?.name ?? m.userId.slice(-6)}</TD>
                    <TD>{m.role}</TD>
                    <TD>{new Date(m.addedAt).toLocaleDateString()}</TD>
                    {isOwner && (
                      <TD>
                        {cost
                          ? formatPaise(cost.totalPaidPaise, p.currency ?? 'INR')
                          : costs.isLoading
                            ? '…'
                            : '—'}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
