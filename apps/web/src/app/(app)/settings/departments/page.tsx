// Departments management page.
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { createDepartmentSchema, type CreateDepartmentInput } from '@agency/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
} from '@/features/org/org.hooks';

export default function DepartmentsPage() {
  const dq = useDepartments();
  const create = useCreateDepartment();
  const remove = useDeleteDepartment();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateDepartmentInput>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync(values);
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Departments" description="Org-level team groupings." />
        <Button onClick={() => setOpen(true)}>Add department</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All departments</CardTitle>
        </CardHeader>
        <CardContent>
          {dq.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : dq.data && dq.data.length > 0 ? (
            <ul className="divide-y">
              {dq.data.map((d) => (
                <li key={d._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete "${d.name}"?`)) remove.mutate(d._id);
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New department</DialogTitle>
            <DialogDescription>Top-level grouping inside the org.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" {...form.register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
