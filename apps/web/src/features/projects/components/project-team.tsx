// Project team (work view) — who's on the project and their role. Leads/admins can add and remove
// people; no money is shown here (the owner manages fees under People & payments).
'use client';

import { Plus, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ProjectMemberRole, Role } from '@agency/shared';

import { initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { useStaffDirectory } from '@/features/team/team.hooks';

import { useAddProjectMember, useRemoveProjectMember, type ProjectRow } from '../projects.hooks';

export function ProjectTeam({ project }: { project: ProjectRow }) {
  const me = useAuthStore((s) => s.user);
  const canManage = me?.role === Role.ADMIN || me?.role === Role.LEAD || me?.role === Role.OWNER;
  const canBrowsePeople = canManage;
  const staff = useStaffDirectory({ enabled: canBrowsePeople });
  const add = useAddProjectMember();
  const remove = useRemoveProjectMember();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState<string>();
  const [role, setRole] = useState<ProjectMemberRole>(ProjectMemberRole.CONTRIBUTOR);

  const nameOf = new Map((staff.data ?? []).map((u) => [u._id, u]));
  const onProject = new Set(project.members.map((m) => m.userId));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Team ({project.members.length})</CardTitle>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add member
          </Button>
        )}
      </CardHeader>
      {adding && (
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-5 py-3">
          <div className="min-w-[220px] flex-1">
            <Combobox
              options={(staff.data ?? [])
                .filter((u) => u.role !== Role.CLIENT)
                .map((u) => ({ value: u._id, label: u.name, description: u.email, disabled: onProject.has(u._id) }))}
              value={who}
              onChange={setWho}
              placeholder="Choose a team member"
              loading={staff.isLoading}
            />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)} className="w-[150px]">
            {Object.values(ProjectMemberRole).map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-9"
            disabled={!who || add.isPending}
            onClick={async () => {
              await add.mutateAsync({ id: project._id, body: { userId: who!, role } });
              setWho(undefined);
              setAdding(false);
            }}
          >
            Add
          </Button>
        </div>
      )}
      <CardContent className="p-0">
        {project.members.length === 0 ? (
          <EmptyState title="No one on this project yet" />
        ) : (
          <ul className="divide-y">
            {project.members.map((m) => {
              const u = nameOf.get(m.userId);
              const name = m.name ?? u?.name ?? (m.userId === me?.id ? me.name : 'Team member');
              return (
                <li key={m.userId} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {canBrowsePeople ? (
                      <Link href={`/team/${m.userId}`} className="text-sm font-medium hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">
                        {name}
                        {m.userId === me?.id && <span className="text-muted-foreground"> (you)</span>}
                      </p>
                    )}
                    {u?.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                  </div>
                  <Badge variant={m.role === ProjectMemberRole.LEAD ? 'default' : 'muted'}>
                    {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                  </Badge>
                  {canManage && m.userId !== me?.id && (
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove ${name} from ${project.name}?`,
                          description: 'They will lose access to this project. Any payments already made stay recorded.',
                          confirmText: 'Remove',
                          destructive: true,
                        });
                        if (ok) remove.mutate({ id: project._id, userId: m.userId });
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
