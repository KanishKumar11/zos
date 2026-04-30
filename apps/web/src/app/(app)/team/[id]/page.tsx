// Team member detail page — overview + admin actions (role/status), deactivate/reactivate.
'use client';

import { use, useState } from 'react';

import { Role, UserStatus } from '@agency/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { isOwner } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import {
  useAdminUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useTeamMember,
} from '@/features/team/team.hooks';

export default function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user);
  const member = useTeamMember(id);
  const adminUpdate = useAdminUpdateUser();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');

  if (member.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!member.data) return <p className="text-sm text-muted-foreground">Member not found.</p>;
  const u = member.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{u.name}</h1>
        <p className="text-sm text-muted-foreground">{u.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <Field label="Role" value={<Badge variant="outline">{u.role}</Badge>} />
          <Field
            label="Status"
            value={<Badge variant={u.status === UserStatus.ACTIVE ? 'default' : 'secondary'}>{u.status}</Badge>}
          />
          <Field label="Phone" value={u.phone ?? '—'} />
          <Field label="Joined" value={u.dateOfJoining ? new Date(u.dateOfJoining).toLocaleDateString() : '—'} />
          <Field label="Last login" value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'} />
        </CardContent>
      </Card>

      {(me?.role === Role.OWNER || me?.role === Role.ADMIN) && (
        <Card>
          <CardHeader>
            <CardTitle>Admin actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Change role</Label>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="">Select…</option>
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r} disabled={r === Role.OWNER && !isOwner(me?.role)}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Change status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                  <option value="">Select…</option>
                  {Object.values(UserStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!role && !status}
                onClick={() => {
                  adminUpdate.mutate({
                    id: u._id,
                    body: {
                      ...(role ? { role } : {}),
                      ...(status ? { status } : {}),
                    },
                  });
                }}
              >
                Save changes
              </Button>
              {u.status === UserStatus.ACTIVE ? (
                <Button variant="destructive" onClick={() => deactivate.mutate(u._id)}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => reactivate.mutate(u._id)}>
                  Reactivate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
