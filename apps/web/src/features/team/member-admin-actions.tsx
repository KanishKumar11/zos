// Access & role for one member (OWNER/ADMIN only): change role, change status, deactivate /
// reactivate, and (OWNER) delete. Every change explains its consequence before it happens.
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Role, STAFF_ROLES, UserStatus, canSignIn } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { isOwner } from '@/lib/roles';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { statusLabel } from '@/components/ui/status-badge';

import { ROLE_LABEL, teamApi, type UserRow } from './team.api';
import { useAdminUpdateUser, useDeactivateUser, useReactivateUser } from './team.hooks';

const ROLE_MEANING: Record<Role, string> = {
  OWNER: 'Full access, including all money, compensation and bank details.',
  ADMIN: 'Can manage people, attendance, payroll and settings. Cannot see project money.',
  LEAD: 'Can see the team and manage projects they lead.',
  MEMBER: 'Sees their own work, projects they are on and their own pay.',
  INTERN: 'Same as a member, for interns.',
  CLIENT: 'Client portal only.',
};

/** Statuses an admin can pick directly. SUSPENDED goes through Deactivate; INVITED is set by invites. */
const PICKABLE_STATUSES = [UserStatus.ACTIVE, UserStatus.PROBATION, UserStatus.ON_LEAVE, UserStatus.EXITED];

export function MemberAdminActions({ user, viewerId, viewerRole }: { user: UserRow; viewerId?: string; viewerRole?: Role }) {
  const router = useRouter();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const update = useAdminUpdateUser();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const remove = useMutation({
    mutationFn: () => teamApi.remove(user._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${user.name} was deleted`);
      router.push('/team');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  useEffect(() => setRole(user.role), [user.role]);
  useEffect(() => setStatus(user.status), [user.status]);

  const isSelf = viewerId === user._id;
  const ownerOnly = user.role === Role.OWNER && !isOwner(viewerRole);
  const busy = update.isPending || deactivate.isPending || reactivate.isPending || remove.isPending;

  if (isSelf) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is you. You can&apos;t change your own role or deactivate yourself — ask another admin or the owner.
        </CardContent>
      </Card>
    );
  }
  if (ownerOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Only the owner can change or deactivate an owner account.
        </CardContent>
      </Card>
    );
  }

  const changeRole = async () => {
    if (role === user.role) return;
    const ok = await confirm({
      title: `Make ${user.name} ${/^[aeiou]/i.test(ROLE_LABEL[role]) ? 'an' : 'a'} ${ROLE_LABEL[role].toLowerCase()}?`,
      description: `${ROLE_MEANING[role]} The change applies the next time their session refreshes (within a few minutes).`,
      confirmText: 'Change role',
    });
    if (!ok) return setRole(user.role);
    update.mutate(
      { id: user._id, body: { role } },
      {
        onError: (err) => {
          toast.error(getErrorMessage(err));
          setRole(user.role);
        },
      },
    );
  };

  const changeStatus = async () => {
    if (status === user.status) return;
    const signsOut = canSignIn(user.status) && !canSignIn(status);
    const ok = await confirm({
      title: `Set ${user.name} to “${statusLabel(status)}”?`,
      description: signsOut
        ? 'They will be signed out everywhere straight away and won’t be able to sign in. Their history, payslips and payments are kept.'
        : status === UserStatus.ON_LEAVE
          ? 'They can still sign in. Payroll still includes them while on leave.'
          : 'They can sign in and are included in payroll.',
      confirmText: 'Change status',
      destructive: signsOut,
    });
    if (!ok) return setStatus(user.status);
    update.mutate(
      { id: user._id, body: { status } },
      {
        onError: (err) => {
          toast.error(getErrorMessage(err));
          setStatus(user.status);
        },
      },
    );
  };

  const onDeactivate = async () => {
    const ok = await confirm({
      title: `Deactivate ${user.name}?`,
      description:
        'They are signed out everywhere straight away and can’t sign in until reactivated. They drop out of future payroll runs. Their history, payslips and payments are kept.',
      confirmText: 'Deactivate',
      destructive: true,
    });
    if (ok) deactivate.mutate(user._id);
  };

  const onReactivate = async () => {
    const ok = await confirm({
      title: `Reactivate ${user.name}?`,
      description: 'They can sign in again with their existing password and are included in payroll again.',
      confirmText: 'Reactivate',
    });
    if (ok) reactivate.mutate(user._id);
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${user.name}?`,
      description:
        'They are signed out and removed from the team list. Past payslips, payments and audit history keep their name. This can’t be undone from the app — deactivate instead if they might come back.',
      confirmText: 'Delete member',
      destructive: true,
    });
    if (ok) remove.mutate();
  };

  const active = canSignIn(user.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access & role</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Role" hint={ROLE_MEANING[role]}>
            <div className="flex gap-2">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={busy}>
                {STAFF_ROLES.filter((r) => r !== Role.OWNER || isOwner(viewerRole)).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              <Button variant="outline" disabled={role === user.role || busy} onClick={() => void changeRole()}>
                Change
              </Button>
            </div>
          </FormField>
          <FormField
            label="Status"
            hint={
              user.status === UserStatus.INVITED
                ? 'They haven’t accepted their invite yet.'
                : user.status === UserStatus.SUSPENDED
                  ? 'Deactivated — use Reactivate to restore access.'
                  : undefined
            }
          >
            <div className="flex gap-2">
              <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)} disabled={busy || !active}>
                {!PICKABLE_STATUSES.includes(user.status) && <option value={user.status}>{statusLabel(user.status)}</option>}
                {PICKABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
              <Button variant="outline" disabled={status === user.status || busy || !active} onClick={() => void changeStatus()}>
                Change
              </Button>
            </div>
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {active ? (
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void onDeactivate()}>
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          ) : user.status !== UserStatus.INVITED ? (
            <Button size="sm" disabled={busy} onClick={() => void onReactivate()}>
              {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
            </Button>
          ) : null}
          {isOwner(viewerRole) && (
            <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void onDelete()}>
              Delete member
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {active ? 'Deactivating signs them out immediately.' : 'They currently can’t sign in.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
