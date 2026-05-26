// Designations management page — grouped by department.
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { createDesignationSchema, type CreateDesignationInput } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

import { PageHeader } from '@/components/layout/page-header';
import { useDepartments } from '@/features/org/org.hooks';
import {
  useCreateDesignation,
  useDeleteDesignation,
  useDesignations,
} from '@/features/org/org.hooks';

export default function DesignationsPage() {
  const departments = useDepartments();
  const designations = useDesignations();
  const create = useCreateDesignation();
  const remove = useDeleteDesignation();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateDesignationInput>({
    resolver: zodResolver(createDesignationSchema),
    defaultValues: { title: '', departmentId: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync(values);
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Designations" description="Job roles grouped by department." />
        <Button onClick={() => setOpen(true)} disabled={!departments.data?.length}>
          Add designation
        </Button>
      </div>

      {(departments.data ?? []).map((dept) => {
        const items = (designations.data ?? []).filter((d) => d.departmentId === dept._id);
        return (
          <Card key={dept._id}>
            <CardHeader>
              <CardTitle>{dept.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <ul className="divide-y">
                  {items.map((d) => (
                    <li key={d._id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{d.title}</p>
                        {d.seniorityLevel && (
                          <p className="text-xs text-muted-foreground">L{d.seniorityLevel}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete "${d.title}"?`)) remove.mutate(d._id);
                        }}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No designations.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New designation</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register('title')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" {...form.register('departmentId')}>
                <option value="">Select…</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="seniorityLevel">Seniority level (1–10)</Label>
              <Input
                id="seniorityLevel"
                type="number"
                min={1}
                max={10}
                {...form.register('seniorityLevel', { valueAsNumber: true })}
              />
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
