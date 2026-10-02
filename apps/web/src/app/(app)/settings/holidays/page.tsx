// Holiday calendar — add, edit, remove. Regular holidays are days off for payroll; optional
// (restricted) holidays are normal working days that people may take as leave.
'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Role } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useCreateHoliday, useDeleteHoliday, useHolidays, useUpdateHoliday } from '@/features/settings/settings.hooks';
import type { HolidayRow } from '@/features/settings/settings.api';

/** Holidays are stored at UTC midnight; show the calendar date, not a timezone-shifted one. */
const holidayDate = (iso: string) => iso.slice(0, 10);
const asLocal = (iso: string) => new Date(`${holidayDate(iso)}T00:00:00`);
const weekday = (iso: string) => asLocal(iso).toLocaleDateString('en-IN', { weekday: 'short' });

export default function HolidaysPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === Role.OWNER || role === Role.ADMIN;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const list = useHolidays(year);
  const remove = useDeleteHoliday();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<HolidayRow | 'new' | null>(null);

  const onDelete = async (h: HolidayRow) => {
    const ok = await confirm({
      title: `Remove ${h.name}?`,
      description: `${formatDate(asLocal(h.date))} becomes a normal working day. Draft payroll runs change when you recalculate them.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) remove.mutate(h._id);
  };

  const rows = list.data ?? [];
  const today = toLocalDateInput(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holidays"
        crumbs={[{ label: 'Settings', href: '/settings' }]}
        description="Days off for everyone. Payroll doesn’t count regular holidays as working days."
        action={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-sm font-medium tabular-nums">{year}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add holiday
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={`No holidays for ${year}`}
              action={canManage ? <Button size="sm" onClick={() => setEditing('new')}>Add a holiday</Button> : undefined}
            />
          ) : (
            <ul className="divide-y">
              {rows.map((h) => {
                const past = holidayDate(h.date) < today;
                return (
                  <li key={h._id} className={`flex items-center gap-3 px-4 py-3 ${past ? 'opacity-60' : ''}`}>
                    <div className="w-24 shrink-0 text-sm tabular-nums">
                      <p className="font-medium">{formatDate(asLocal(h.date), { day: 'numeric', month: 'short' })}</p>
                      <p className="text-xs text-muted-foreground">{weekday(h.date)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {h.name} {h.optional && <Badge variant="muted" className="ml-1">Optional</Badge>}
                      </p>
                      {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                    </div>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => void onDelete(h)}
                          aria-label={`Remove ${h.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <HolidayDialog editing={editing} defaultYear={year} onClose={() => setEditing(null)} />
    </div>
  );
}

function HolidayDialog({ editing, defaultYear, onClose }: { editing: HolidayRow | 'new' | null; defaultYear: number; onClose: () => void }) {
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const existing = editing && editing !== 'new' ? editing : undefined;
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [optional, setOptional] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!editing) return;
    setName(existing?.name ?? '');
    setDate(existing ? holidayDate(existing.date) : defaultYear === new Date().getFullYear() ? '' : `${defaultYear}-01-01`);
    setOptional(!!existing?.optional);
    setNote(existing?.note ?? '');
    setErrors({});
    setServerError(undefined);
  }, [editing, existing, defaultYear]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!date) e.date = 'Pick a date';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = { name: name.trim(), date: date as unknown as Date, optional, note: note.trim() || undefined };
    setServerError(undefined);
    try {
      if (existing) await update.mutateAsync({ id: existing._id, body: { ...body, note: note.trim() } });
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
          <DialogTitle>{existing ? `Edit ${existing.name}` : 'New holiday'}</DialogTitle>
          <DialogDescription>Everyone on the team sees holidays on their attendance page.</DialogDescription>
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
            <Input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" />
          </FormField>
          <FormField label="Date" required error={errors.date}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
            <span>
              Optional holiday
              <span className="block text-xs text-muted-foreground">
                A normal working day that people may take off as leave. Payroll still counts it as a working day.
              </span>
            </span>
          </label>
          <FormField label="Note" hint="Optional" error={errors.note}>
            <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : existing ? 'Save changes' : 'Add holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
