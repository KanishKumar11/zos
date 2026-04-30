// Holidays calendar settings page.
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { createHolidaySchema, type CreateHolidayInput } from '@agency/shared';

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

import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from '@/features/settings/settings.hooks';

export default function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const list = useHolidays(year);
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateHolidayInput>({
    resolver: zodResolver(createHolidaySchema),
    defaultValues: { name: '', date: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync(values);
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holidays</h1>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28"
          />
          <Button onClick={() => setOpen(true)}>Add holiday</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{year} calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list.data && list.data.length > 0 ? (
            <ul className="divide-y">
              {list.data.map((h) => (
                <li key={h._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.date).toLocaleDateString()} {h.optional ? '(optional)' : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(h._id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No holidays for this year.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New holiday</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" {...form.register('date')} />
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
