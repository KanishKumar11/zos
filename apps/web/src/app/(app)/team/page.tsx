// Team listing page — search + role/status filters + invite modal + row actions.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Role, UserStatus, type ListUsersQuery } from '@agency/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import { useDepartments } from '@/features/org/org.hooks';
import { useInviteMember, useTeamList } from '@/features/team/team.hooks';

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  departmentId: z.string().optional(),
});

export default function TeamPage() {
  const [filters, setFilters] = useState<ListUsersQuery>({ page: 1, pageSize: 20 });
  const list = useTeamList(filters);
  const invite = useInviteMember();
  const departments = useDepartments();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', name: '', role: Role.MEMBER },
  });

  const onInvite = form.handleSubmit(async (values) => {
    await invite.mutateAsync(values);
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Team</h1>
        <Button onClick={() => setOpen(true)}>Invite member</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Search name or email"
          value={filters.q ?? ''}
          onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined, page: 1 })}
        />
        <Select
          value={filters.role ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, role: (e.target.value || undefined) as Role | undefined, page: 1 })
          }
        >
          <option value="">All roles</option>
          {Object.values(Role).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: (e.target.value || undefined) as UserStatus | undefined,
              page: 1,
            })
          }
        >
          <option value="">All statuses</option>
          {Object.values(UserStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={filters.departmentId ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, departmentId: e.target.value || undefined, page: 1 })
          }
        >
          <option value="">All departments</option>
          {(departments.data ?? []).map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.isLoading ? (
              <TR>
                <TD colSpan={5}>Loading…</TD>
              </TR>
            ) : list.data?.items.length ? (
              list.data.items.map((u) => (
                <TR key={u._id}>
                  <TD className="font-medium">{u.name}</TD>
                  <TD>{u.email}</TD>
                  <TD>
                    <Badge variant="outline">{u.role}</Badge>
                  </TD>
                  <TD>
                    <Badge variant={u.status === UserStatus.ACTIVE ? 'default' : 'secondary'}>
                      {u.status}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Link href={`/team/${u._id}`} className="text-sm text-primary hover:underline">
                      Open
                    </Link>
                  </TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={5}>No members found.</TD>
              </TR>
            )}
          </TBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
          </DialogHeader>
          <form onSubmit={onInvite} className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...form.register('email')} />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select {...form.register('role')}>
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department (optional)</Label>
              <Select {...form.register('departmentId')}>
                <option value="">—</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
