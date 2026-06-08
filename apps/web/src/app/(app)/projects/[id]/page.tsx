// Project detail.
'use client';

import { use, useRef, useState } from 'react';

import { Role } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { useProject, useSetMemberCost } from '@/features/projects/projects.hooks';
import { useTeamList } from '@/features/team/team.hooks';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const team = useTeamList({ pageSize: 100 });

  if (project.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const p = project.data;

  const nameMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));
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
                {isOwner && <TH>Paid (₹)</TH>}
              </TR>
            </THead>
            <TBody>
              {p.members.map((m) => (
                <MemberRow
                  key={m.userId}
                  projectId={id}
                  member={m}
                  name={nameMap.get(m.userId) ?? m.userId.slice(-6)}
                  currency={p.currency ?? 'INR'}
                  isOwner={isOwner}
                />
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({
  projectId,
  member,
  name,
  currency,
  isOwner,
}: {
  projectId: string;
  member: { userId: string; role: string; addedAt: string; amountPaise: number };
  name: string;
  currency: string;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [displayPaise, setDisplayPaise] = useState<number | null>(null);
  const committed = useRef(false);
  const dirty = useRef(false);
  const setCost = useSetMemberCost();

  const shownPaise = displayPaise ?? (member.amountPaise ?? 0);

  const startEdit = () => {
    committed.current = false;
    dirty.current = false;
    setDraft(String(Math.round(shownPaise / 100)));
    setEditing(true);
  };

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    setEditing(false);
    if (!dirty.current) return;
    const inr = parseFloat(draft);
    if (!isNaN(inr) && inr >= 0) {
      const paise = Math.round(inr * 100);
      setDisplayPaise(paise);
      setCost.mutate({ id: projectId, userId: member.userId, amountPaise: paise });
    }
  };

  const cancel = () => {
    committed.current = true;
    setEditing(false);
  };

  return (
    <TR>
      <TD className="font-medium">{name}</TD>
      <TD>{member.role}</TD>
      <TD>{new Date(member.addedAt).toLocaleDateString()}</TD>
      {isOwner && (
        <TD>
          {editing ? (
            <Input
              autoFocus
              type="number"
              min={0}
              className="h-7 w-28 text-sm"
              value={draft}
              onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') cancel();
              }}
            />
          ) : (
            <button
              className="rounded px-1 text-left hover:bg-muted"
              onClick={startEdit}
              title="Click to edit"
            >
              {shownPaise > 0
                ? formatPaise(shownPaise, currency)
                : <span className="text-muted-foreground">— click to set</span>}
            </button>
          )}
        </TD>
      )}
    </TR>
  );
}
