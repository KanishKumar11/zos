// Departments — create, rename, delete (blocked while people are still in it).
'use client';

import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Role } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
  type DepartmentRow,
} from '@/features/org/org.hooks';

export default function DepartmentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === Role.OWNER || role === Role.ADMIN;
  const dq = useDepartments();
  const remove = useDeleteDepartment();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<DepartmentRow | 'new' | null>(null);

  const onDelete = async (d: DepartmentRow) => {
    if (d.memberCount) {
      await confirm({
        title: `${d.name} still has ${d.memberCount} member${d.memberCount === 1 ? '' : 's'}`,
        description: 'Move them to another department from their profile first, then delete it.',
        confirmText: 'OK',
        cancelText: 'Close',
      });
      return;
    }
    const ok = await confirm({
      title: `Delete ${d.name}?`,
      description: 'Its designations stay but will show as belonging to a deleted department.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(d._id);
  };

  const rows = dq.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        crumbs={[{ label: 'Settings', href: '/settings' }]}
        description="Top-level groupings for your team, like Design or Engineering."
        action={
          canManage ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add department
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="p-0">
          {dq.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : dq.isError ? (
            <ErrorState error={dq.error} onRetry={() => dq.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Departments help you filter the team and group designations."
              action={canManage ? <Button size="sm" onClick={() => setEditing('new')}>Add a department</Button> : undefined}
            />
          ) : (
            <ul className="divide-y">
              {rows.map((d) => (
                <li key={d._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/team?departmentId=${d._id}`} className="hover:underline">
                        {d.memberCount ?? 0} member{d.memberCount === 1 ? '' : 's'}
                      </Link>
                      {d.description ? ` · ${d.description}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => void onDelete(d)}
                        aria-label={`Delete ${d.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DepartmentDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DepartmentDialog({ editing, onClose }: { editing: DepartmentRow | 'new' | null; onClose: () => void }) {
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();
  const existing = editing && editing !== 'new' ? editing : undefined;

  useEffect(() => {
    if (!editing) return;
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setErrors({});
    setServerError(undefined);
  }, [editing, existing]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = { name: name.trim(), description: description.trim() || undefined };
    setServerError(undefined);
    try {
      if (existing) await update.mutateAsync({ id: existing._id, body: { ...body, description: description.trim() } });
      else await create.mutateAsync(body);
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : 'New department'}</DialogTitle>
          <DialogDescription>Top-level grouping inside your team.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <FormField label="Name" required error={errors.name}>
            <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Description" hint="Optional" error={errors.description}>
            <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : existing ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
