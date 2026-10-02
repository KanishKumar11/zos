// Designations — job titles grouped by department. Create, edit, delete.
'use client';

import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Role } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  useCreateDesignation,
  useDeleteDesignation,
  useDepartments,
  useDesignations,
  useUpdateDesignation,
  type DesignationRow,
} from '@/features/org/org.hooks';

type Editing = DesignationRow | { new: true; departmentId?: string } | null;

export default function DesignationsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === Role.OWNER || role === Role.ADMIN;
  const departments = useDepartments();
  const designations = useDesignations();
  const remove = useDeleteDesignation();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing>(null);

  const onDelete = async (d: DesignationRow) => {
    const ok = await confirm({
      title: `Delete “${d.title}”?`,
      description: 'You can only delete a designation nobody has. People keep their other details.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(d._id);
  };

  const loading = departments.isLoading || designations.isLoading;
  const error = departments.error ?? designations.error;
  const depts = departments.data ?? [];
  const deptIds = new Set(depts.map((d) => d._id));
  const orphans = (designations.data ?? []).filter((d) => !deptIds.has(d.departmentId));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designations"
        crumbs={[{ label: 'Settings', href: '/settings' }]}
        description="Job titles inside each department, e.g. Senior designer."
        action={
          canManage ? (
            <Button size="sm" onClick={() => setEditing({ new: true })} disabled={!depts.length}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add designation
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => {
            void departments.refetch();
            void designations.refetch();
          }} />
      ) : depts.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Add a department first"
          description="Every designation belongs to a department."
          action={
            <Link href="/settings/departments">
              <Button size="sm">Go to departments</Button>
            </Link>
          }
        />
      ) : (
        <>
          {depts.map((dept) => {
            const items = (designations.data ?? []).filter((d) => d.departmentId === dept._id);
            return (
              <Card key={dept._id}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ new: true, departmentId: dept._id })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {items.length > 0 ? (
                    <ul className="divide-y">
                      {items.map((d) => (
                        <DesignationItem key={d._id} d={d} canManage={canManage} onEdit={() => setEditing(d)} onDelete={() => void onDelete(d)} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No designations yet.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {orphans.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">Deleted department</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {orphans.map((d) => (
                    <DesignationItem key={d._id} d={d} canManage={canManage} onEdit={() => setEditing(d)} onDelete={() => void onDelete(d)} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <DesignationDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DesignationItem({ d, canManage, onEdit, onDelete }: { d: DesignationRow; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {d.title} {d.seniorityLevel ? <Badge variant="muted" className="ml-1">Level {d.seniorityLevel}</Badge> : null}
        </p>
        {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
      </div>
      {canManage && (
        <>
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${d.title}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label={`Delete ${d.title}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </li>
  );
}

function DesignationDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const departments = useDepartments();
  const create = useCreateDesignation();
  const update = useUpdateDesignation();
  const existing = editing && !('new' in editing) ? editing : undefined;
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [seniority, setSeniority] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!editing) return;
    setTitle(existing?.title ?? '');
    setDepartmentId(existing?.departmentId ?? ('new' in editing ? (editing.departmentId ?? '') : ''));
    setSeniority(existing?.seniorityLevel ? String(existing.seniorityLevel) : '');
    setDescription(existing?.description ?? '');
    setErrors({});
    setServerError(undefined);
  }, [editing, existing]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 2) e.title = 'Title must be at least 2 characters';
    if (!departmentId) e.departmentId = 'Pick a department';
    const level = seniority.trim() === '' ? undefined : Number(seniority);
    if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 10)) e.seniorityLevel = 'Use a whole number from 1 to 10, or leave it empty';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      title: title.trim(),
      departmentId,
      description: description.trim() || undefined,
      ...(level !== undefined ? { seniorityLevel: level } : {}),
    };
    setServerError(undefined);
    try {
      if (existing) await update.mutateAsync({ id: existing._id, body });
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
          <DialogTitle>{existing ? `Edit ${existing.title}` : 'New designation'}</DialogTitle>
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
          <FormField label="Title" required error={errors.title}>
            <Input autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior designer" />
          </FormField>
          <FormField label="Department" required error={errors.departmentId}>
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select…</option>
              {(departments.data ?? []).map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Seniority level" hint="Optional, 1 (junior) to 10 (most senior)" error={errors.seniorityLevel}>
            <Input type="number" inputMode="numeric" min={1} max={10} value={seniority} onChange={(e) => setSeniority(e.target.value)} />
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
