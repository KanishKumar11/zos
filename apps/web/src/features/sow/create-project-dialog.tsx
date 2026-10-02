// "Create project from SOW" — name/code/dates; budget, client and milestones come from the SOW.
'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { formatPaise } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

import { useCreateProjectFromSow, type SowRow } from './sow.hooks';

const suggestCode = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (all.length === 1 ? w.slice(0, 6) : w.slice(0, i === 0 ? 4 : 3)))
    .join('-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
    .slice(0, 16);

export function CreateProjectFromSowDialog({
  sow,
  clientName,
  open,
  onOpenChange,
  onCreated,
}: {
  sow: SowRow;
  clientName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (projectId: string) => void;
}) {
  const create = useCreateProjectFromSow();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();
  const codeTouched = useRef(false);

  useEffect(() => {
    if (!open) return;
    setName(sow.title);
    setCode(suggestCode(sow.title));
    const dues = sow.milestones.map((m) => m.dueDate?.slice(0, 10)).filter((d): d is string => !!d).sort();
    setStartDate('');
    setEndDate(dues[dues.length - 1] ?? '');
    setErrors({});
    setServerError(undefined);
    codeTouched.current = false;
  }, [open, sow]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Give the project a name';
    if (code.trim().length < 2) e.code = 'Add a short code, e.g. WEB-24';
    if (startDate && endDate && endDate < startDate) e.endDate = 'End date must be after the start date';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const res = await create.mutateAsync({
        id: sow._id,
        body: { name: name.trim(), code: code.trim(), startDate: startDate || undefined, endDate: endDate || undefined },
      });
      onOpenChange(false);
      onCreated?.(res.project._id);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project from this SOW</DialogTitle>
          <DialogDescription>
            The project gets {clientName} as its client, a budget of {formatPaise(sow.totalValuePaise, sow.currency)}
            {sow.milestones.length
              ? ` and the ${sow.milestones.length} milestone${sow.milestones.length === 1 ? '' : 's'} below`
              : ''}
            . The SOW is linked to it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <FormField label="Project name" required error={errors.name}>
              <Input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!codeTouched.current) setCode(suggestCode(e.target.value));
                  setErrors((x) => ({ ...x, name: undefined }));
                }}
              />
            </FormField>
            <FormField label="Code" required error={errors.code}>
              <Input
                value={code}
                className="font-mono uppercase"
                onChange={(e) => {
                  codeTouched.current = true;
                  setCode(e.target.value.toUpperCase());
                  setErrors((x) => ({ ...x, code: undefined }));
                }}
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Start date" error={errors.startDate}>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date" error={errors.endDate} hint={sow.milestones.some((m) => m.dueDate) ? 'Defaults to the last milestone' : undefined}>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          </div>
          {sow.milestones.length > 0 && (
            <ul className="divide-y rounded-md border text-sm">
              {sow.milestones.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">{m.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatPaise(m.amountPaise, sow.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
