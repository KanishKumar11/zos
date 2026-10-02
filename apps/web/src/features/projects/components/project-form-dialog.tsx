// Create / edit project dialog. Owner-only fields (client, budget, portal visibility) only render
// for the owner; everyone else can't send them (the API rejects them too).
'use client';

import { useEffect, useRef, useState } from 'react';

import { ProjectStatus, Role, type CreateProjectInput } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { statusLabel } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useClients } from '@/features/clients/clients.hooks';

import { useCreateProject, useUpdateProject, type ProjectRow } from '../projects.hooks';

interface Values {
  name: string;
  code: string;
  status: ProjectStatus;
  clientId: string;
  startDate: string;
  endDate: string;
  clientBudgetPaise?: number;
  description: string;
  brief: string;
  portalVisible: boolean;
}

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

const fromProject = (p?: ProjectRow, clientId?: string): Values => ({
  name: p?.name ?? '',
  code: p?.code ?? '',
  status: p?.status ?? ProjectStatus.ACTIVE,
  clientId: p?.clientId ?? clientId ?? '',
  startDate: p?.startDate?.slice(0, 10) ?? '',
  endDate: p?.endDate?.slice(0, 10) ?? '',
  clientBudgetPaise: p?.clientBudgetPaise || undefined,
  description: p?.description ?? '',
  brief: p?.brief ?? '',
  portalVisible: p?.portalVisible ?? true,
});

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: ProjectRow;
  defaultClientId?: string;
  onSaved?: (p: ProjectRow) => void;
}) {
  const isOwner = useAuthStore((s) => s.user?.role) === Role.OWNER;
  const clients = useClients(undefined);
  const create = useCreateProject();
  const update = useUpdateProject();
  const [v, setV] = useState<Values>(() => fromProject(project, defaultClientId));
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [serverError, setServerError] = useState<string>();
  const codeTouched = useRef(!!project);

  useEffect(() => {
    if (!open) return;
    setV(fromProject(project, defaultClientId));
    setErrors({});
    setServerError(undefined);
    codeTouched.current = !!project;
  }, [open, project, defaultClientId]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((prev) => {
      const next = { ...prev, [k]: val };
      if (k === 'name' && !codeTouched.current) next.code = suggestCode(String(val));
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (v.name.trim().length < 2) e.name = 'Give the project a name';
    if (v.code.trim().length < 2) e.code = 'Add a short code, e.g. WEB-24';
    if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = 'End date is before the start date';
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: Record<string, unknown> = {
      name: v.name.trim(),
      code: v.code.trim(),
      status: v.status,
      description: v.description,
      brief: v.brief,
      ...(v.startDate ? { startDate: v.startDate } : {}),
      ...(v.endDate ? { endDate: v.endDate } : {}),
    };
    if (isOwner) {
      body.clientId = v.clientId || undefined;
      body.clientBudgetPaise = v.clientBudgetPaise ?? 0;
      body.portalVisible = v.portalVisible;
    }
    try {
      const saved = project
        ? await update.mutateAsync({ id: project._id, body: body as never })
        : await create.mutateAsync(body as unknown as CreateProjectInput);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <FormField label="Project name" required error={errors.name}>
              <Input autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Website revamp" />
            </FormField>
            <FormField label="Code" required error={errors.code}>
              <Input
                value={v.code}
                onChange={(e) => {
                  codeTouched.current = true;
                  set('code', e.target.value.toUpperCase());
                }}
                placeholder="WEB-24"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Status">
              <Select value={v.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                {Object.values(ProjectStatus).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </FormField>
            {isOwner && (
              <FormField label="Client">
                <Combobox
                  options={[
                    { value: '', label: 'No client (internal)' },
                    ...(clients.data ?? []).map((c) => ({ value: c._id, label: c.name })),
                  ]}
                  value={v.clientId}
                  onChange={(id) => set('clientId', id ?? '')}
                  placeholder="No client (internal)"
                  loading={clients.isLoading}
                />
              </FormField>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start date">
              <Input type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </FormField>
            <FormField label="End date" error={errors.endDate}>
              <Input type="date" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
            </FormField>
          </div>
          {isOwner && (
            <>
              <FormField label="Client budget" hint="What the client pays for this project. Margin is worked out from agreed team and freelancer fees.">
                <MoneyInput value={v.clientBudgetPaise} onChange={(val) => set('clientBudgetPaise', val)} placeholder="0" />
              </FormField>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={v.portalVisible}
                  onChange={(e) => set('portalVisible', e.target.checked)}
                />
                <span>
                  Show in the client portal
                  <span className="block text-xs text-muted-foreground">The client&apos;s users see status, milestones and anything you share.</span>
                </span>
              </label>
            </>
          )}
          <FormField label="Short description">
            <Input value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="One line about the project" />
          </FormField>
          <FormField label="Brief" hint="Visible to everyone on the project.">
            <Textarea rows={4} value={v.brief} onChange={(e) => set('brief', e.target.value)} />
          </FormField>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
