// Log payment — the one place money out is recorded. Opened from "+ New", ⌘K, a project, a
// person, or the Payments page (prefilled where possible). Also edits an existing payment.
//
// Handles the awkward cases up front instead of failing on save:
//  • person not on the chosen project → add them inline (with their agreed fee)
//  • brand-new freelancer → create inline
//  • same amount already logged to the same person that day → duplicate warning
//  • paying past the agreed fee → shown before saving, allowed
//  • closing with unsaved input → confirm
'use client';

import { AlertTriangle, Info, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  PAYOUT_CATEGORY_LABEL,
  PAYOUT_METHOD_LABEL,
  PayeeType,
  PayoutCategory,
  PayoutMethod,
  ProjectMemberRole,
  Role,
} from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions, type LogPaymentPrefill } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Price, useCanSeePrices } from '@/components/viz';
import { useCreateFreelancer, useFreelancers } from '@/features/freelancers/freelancers.hooks';
import {
  useAddProjectFreelancer,
  useAddProjectMember,
  useAllProjects,
} from '@/features/projects/projects.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

import {
  useCreatePayout,
  useDeletePayout,
  usePayeeBalances,
  usePayout,
  usePayouts,
  useUpdatePayout,
} from './payouts.hooks';

const NO_PROJECT = '__none__';

interface FormState {
  payee: string; // "MEMBER:<id>" | "FREELANCER:<id>"
  projectId: string; // project id | NO_PROJECT | ''
  amountPaise: number | undefined;
  paidAt: string;
  method: PayoutMethod;
  reference: string;
  category: PayoutCategory;
  note: string;
}

const blank = (prefill: LogPaymentPrefill = {}, keep?: Partial<FormState>): FormState => ({
  payee: prefill.userId
    ? `${PayeeType.MEMBER}:${prefill.userId}`
    : prefill.freelancerId
      ? `${PayeeType.FREELANCER}:${prefill.freelancerId}`
      : '',
  projectId: prefill.projectId ?? '',
  amountPaise: prefill.amountPaise,
  paidAt: keep?.paidAt ?? todayLocal(),
  method: keep?.method ?? PayoutMethod.BANK,
  reference: '',
  category: (prefill.category as PayoutCategory | undefined) ?? PayoutCategory.PROJECT_FEE,
  note: prefill.note ?? '',
});

const splitPayee = (v: string): { type?: PayeeType; id?: string } => {
  const [type, id] = v.split(':');
  return type && id ? { type: type as PayeeType, id } : {};
};

const yesterday = () => toLocalDateInput(new Date(Date.now() - 86_400_000));

export function LogPaymentSheet() {
  const role = useAuthStore((s) => s.user?.role);
  const { open, prefill, editId } = useQuickActions((s) => s.logPayment);
  const close = useQuickActions((s) => s.closeLogPayment);
  const confirm = useConfirm();
  const canSee = useCanSeePrices();
  const enabled = open && role === Role.OWNER;

  const [form, setForm] = useState<FormState>(() => blank());
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [newFreelancer, setNewFreelancer] = useState<{ name: string; email: string } | null>(null);
  const [addFeePaise, setAddFeePaise] = useState<number | undefined>(undefined);

  const staff = useStaffDirectory({ enabled });
  const freelancers = useFreelancers(undefined, { enabled });
  const projects = useAllProjects({ enabled });
  const editing = usePayout(open ? editId : undefined);

  const { type: payeeType, id: payeeId } = splitPayee(form.payee);
  const balances = usePayeeBalances(payeeType ?? 'MEMBER', payeeId, { enabled: enabled && !!payeeId });

  const create = useCreatePayout();
  const update = useUpdatePayout();
  const remove = useDeletePayout();
  const createFreelancer = useCreateFreelancer();
  const addMember = useAddProjectMember();
  const addFreelancer = useAddProjectFreelancer();

  // Reset whenever the sheet opens (new prefill or a different payment to edit).
  useEffect(() => {
    if (!open) return;
    setForm(blank(prefill));
    setDirty(false);
    setErrors({});
    setServerError(null);
    setNewFreelancer(null);
    setAddFeePaise(undefined);
  }, [open, prefill, editId]);

  useEffect(() => {
    const p = editing.data;
    if (!open || !editId || !p) return;
    setForm({
      payee: `${p.payeeType}:${p.userId ?? p.freelancerId}`,
      projectId: p.projectId ?? NO_PROJECT,
      amountPaise: p.amountPaise,
      paidAt: toLocalDateInput(p.paidAt),
      method: p.method,
      reference: p.reference,
      category: p.category,
      note: p.note,
    });
  }, [open, editId, editing.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };

  // ── Options ─────────────────────────────────────────────────────────────────────
  const payeeOptions = useMemo<ComboboxOption[]>(() => {
    const team = (staff.data ?? [])
      .filter((u) => u.role !== Role.CLIENT)
      .map((u) => ({
        value: `${PayeeType.MEMBER}:${u._id}`,
        label: u.name,
        description: `${u.role.charAt(0)}${u.role.slice(1).toLowerCase()}${u.status !== 'ACTIVE' ? ` · ${u.status.toLowerCase().replace('_', ' ')}` : ''}`,
        group: 'Team',
        keywords: u.email,
      }));
    const fls = (freelancers.data ?? []).map((f) => ({
      value: `${PayeeType.FREELANCER}:${f._id}`,
      label: f.name,
      description: [f.skill, canSee && f.pendingPaise ? `${formatPaise(f.pendingPaise)} pending` : ''].filter(Boolean).join(' · ') || 'Freelancer',
      group: 'Freelancers',
      keywords: f.email,
    }));
    return [...team, ...fls];
  }, [staff.data, freelancers.data, canSee]);

  const balanceByProject = useMemo(
    () => new Map((balances.data ?? []).map((b) => [b.projectId ?? NO_PROJECT, b])),
    [balances.data],
  );

  const projectOptions = useMemo<ComboboxOption[]>(() => {
    const theirs: ComboboxOption[] = [];
    const others: ComboboxOption[] = [];
    for (const p of projects.data?.items ?? []) {
      const b = balanceByProject.get(p._id);
      const onProject =
        payeeType === PayeeType.MEMBER
          ? p.members.some((m) => m.userId === payeeId)
          : (p.freelancers ?? []).some((f) => f.freelancerId === payeeId);
      const opt: ComboboxOption = {
        value: p._id,
        label: p.name,
        keywords: p.code,
        description: onProject && b
          ? canSee
            ? `Agreed ${formatPaise(b.agreedPaise)} · paid ${formatPaise(b.paidPaise)} · ${b.pendingPaise > 0 ? `${formatPaise(b.pendingPaise)} pending` : 'nothing pending'}`
            : p.code
          : payeeId
            ? `${p.code} · not on this project yet`
            : p.code,
        group: payeeId ? (onProject ? 'Their projects' : 'Other projects') : 'Projects',
      };
      (onProject ? theirs : others).push(opt);
    }
    // Keep the payee's own projects first; within each group, ones with money pending first.
    theirs.sort((a, b) => (balanceByProject.get(b.value)?.pendingPaise ?? 0) - (balanceByProject.get(a.value)?.pendingPaise ?? 0));
    return [
      { value: NO_PROJECT, label: 'No project (bonus, advance, general)', group: 'General' },
      ...theirs,
      ...others,
    ];
  }, [projects.data, balanceByProject, payeeType, payeeId, canSee]);

  // ── Derived state ───────────────────────────────────────────────────────────────
  const project = (projects.data?.items ?? []).find((p) => p._id === form.projectId);
  const onProject =
    !project || !payeeId
      ? true
      : payeeType === PayeeType.MEMBER
        ? project.members.some((m) => m.userId === payeeId)
        : (project.freelancers ?? []).some((f) => f.freelancerId === payeeId);
  const balance = project ? balanceByProject.get(project._id) : undefined;
  const payeeName = payeeOptions.find((o) => o.value === form.payee)?.label ?? 'This person';

  // When editing, the current payment is already inside "paid".
  const alreadyCounted = editId && editing.data?.projectId === form.projectId ? editing.data.amountPaise : 0;
  const paidAfter = (balance?.paidPaise ?? 0) - alreadyCounted + (form.amountPaise ?? 0);
  const agreed = balance?.agreedPaise ?? 0;
  const overAgreed = !!balance && agreed > 0 && paidAfter > agreed;
  const pendingNow = balance ? Math.max(0, agreed - (balance.paidPaise - alreadyCounted)) : 0;

  // Duplicate check: same person, same day.
  const sameDay = usePayouts(
    {
      payeeType,
      userId: payeeType === PayeeType.MEMBER ? payeeId : undefined,
      freelancerId: payeeType === PayeeType.FREELANCER ? payeeId : undefined,
      from: form.paidAt,
      to: form.paidAt,
      pageSize: 20,
    },
    { enabled: enabled && !!payeeId && !!form.paidAt },
  );
  const duplicate = (sameDay.data?.items ?? []).find(
    (p) => p._id !== editId && p.amountPaise === form.amountPaise && (p.projectId ?? NO_PROJECT) === (form.projectId || NO_PROJECT),
  );

  const busy = create.isPending || update.isPending || remove.isPending;

  // ── Actions ─────────────────────────────────────────────────────────────────────
  const requestClose = async () => {
    if (busy) return;
    if (dirty && !(await confirm({ title: 'Discard this payment?', description: "What you've entered won't be saved.", confirmText: 'Discard', destructive: true }))) {
      return;
    }
    close();
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!editId && !form.payee) e.payee = 'Choose who you paid';
    if (!form.projectId) e.projectId = 'Choose a project, or "No project"';
    if (!form.amountPaise || form.amountPaise <= 0) e.amountPaise = 'Enter an amount';
    if (!form.paidAt) e.paidAt = 'Pick a date';
    else if (form.paidAt > toLocalDateInput(new Date(Date.now() + 86_400_000 * 31))) e.paidAt = "That's more than a month ahead — check the date";
    if (project && !onProject) e.projectId = `${payeeName} isn't on ${project.name} yet — add them below`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleServerError = (err: unknown) => {
    if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length) {
      const fe: typeof errors = {};
      for (const [k, v] of Object.entries(err.fieldErrors)) {
        const key = (k === 'userId' || k === 'freelancerId' ? 'payee' : k) as keyof FormState;
        fe[key] = v[0];
      }
      setErrors(fe);
    }
    setServerError(getErrorMessage(err));
  };

  const submit = async (another: boolean) => {
    if (busy || !validate()) return;
    const projectId = form.projectId === NO_PROJECT ? undefined : form.projectId;
    try {
      if (editId) {
        await update.mutateAsync({
          id: editId,
          body: {
            projectId: projectId ?? '',
            amountPaise: form.amountPaise,
            paidAt: form.paidAt,
            method: form.method,
            reference: form.reference,
            category: form.category,
            note: form.note,
          },
        });
        close();
        return;
      }
      await create.mutateAsync({
        payeeType: payeeType!,
        userId: payeeType === PayeeType.MEMBER ? payeeId : undefined,
        freelancerId: payeeType === PayeeType.FREELANCER ? payeeId : undefined,
        projectId,
        amountPaise: form.amountPaise!,
        paidAt: form.paidAt,
        method: form.method,
        reference: form.reference || undefined,
        category: form.category,
        note: form.note || undefined,
      });
      if (another) {
        setForm((f) => ({ ...blank({}, f), payee: '', projectId: '' }));
        setDirty(false);
      } else {
        close();
      }
    } catch (err) {
      handleServerError(err);
    }
  };

  const deletePayment = async () => {
    if (!editId) return;
    const ok = await confirm({
      title: 'Delete this payment?',
      description: `${canSee ? `${formatPaise(form.amountPaise ?? 0)} to ` : 'The payment to '}${payeeName}. Balances will update straight away. This is recorded in the audit log.`,
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(editId);
      close();
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const addToProject = async () => {
    if (!project || !payeeId) return;
    try {
      if (payeeType === PayeeType.MEMBER) {
        await addMember.mutateAsync({
          id: project._id,
          body: { userId: payeeId, role: ProjectMemberRole.CONTRIBUTOR, amountPaise: addFeePaise },
        });
      } else {
        await addFreelancer.mutateAsync({ id: project._id, body: { freelancerId: payeeId, agreedPaise: addFeePaise ?? 0 } });
      }
      setErrors((e) => ({ ...e, projectId: undefined }));
      void balances.refetch();
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const saveNewFreelancer = async () => {
    if (!newFreelancer || newFreelancer.name.trim().length < 2) return;
    try {
      const f = await createFreelancer.mutateAsync({ name: newFreelancer.name.trim(), email: newFreelancer.email.trim() });
      await freelancers.refetch();
      set('payee', `${PayeeType.FREELANCER}:${f._id}`);
      setNewFreelancer(null);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  if (role !== Role.OWNER) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && void requestClose()}>
      <SheetContent
        className="sm:max-w-[480px]"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          void requestClose();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          void requestClose();
        }}
      >
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <SheetHeader>
            <SheetTitle>{editId ? 'Edit payment' : 'Log payment'}</SheetTitle>
            <SheetDescription>
              {editId ? 'Changes update every balance and are kept in the audit log.' : 'Record money paid to a team member or freelancer.'}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            {serverError && (
              <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <FormField label="Paid to" required error={errors.payee}>
              {editId ? (
                <Input value={editing.data?.payeeName ?? 'Loading…'} disabled />
              ) : newFreelancer ? (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">New freelancer</p>
                  <Input
                    autoFocus
                    placeholder="Full name"
                    value={newFreelancer.name}
                    onChange={(e) => setNewFreelancer({ ...newFreelancer, name: e.target.value })}
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={newFreelancer.email}
                    onChange={(e) => setNewFreelancer({ ...newFreelancer, email: e.target.value })}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNewFreelancer(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={newFreelancer.name.trim().length < 2 || createFreelancer.isPending}
                      onClick={() => void saveNewFreelancer()}
                    >
                      {createFreelancer.isPending ? 'Adding…' : 'Add freelancer'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Combobox
                  options={payeeOptions}
                  value={form.payee || undefined}
                  onChange={(v) => {
                    set('payee', v ?? '');
                    if (!prefill.projectId) set('projectId', '');
                  }}
                  placeholder="Choose a team member or freelancer"
                  searchPlaceholder="Search people…"
                  loading={staff.isLoading || freelancers.isLoading}
                  invalid={!!errors.payee}
                  footer={
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent"
                      onClick={() => setNewFreelancer({ name: '', email: '' })}
                    >
                      <Plus className="h-3.5 w-3.5" /> New freelancer
                    </button>
                  }
                />
              )}
            </FormField>

            <FormField
              label="For project"
              required
              error={errors.projectId}
              hint={!payeeId ? 'Pick the person first to see their projects and balances.' : undefined}
            >
              <Combobox
                options={projectOptions}
                value={form.projectId || undefined}
                onChange={(v) => set('projectId', v ?? '')}
                placeholder="Choose a project"
                searchPlaceholder="Search projects…"
                loading={projects.isLoading}
                invalid={!!errors.projectId}
              />
            </FormField>

            {project && payeeId && !onProject && (
              <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="h-4 w-4 text-warning" />
                  {payeeName} isn&apos;t on {project.name} yet
                </p>
                <p className="text-xs text-muted-foreground">Add them to the project first. You can set their agreed fee now or later.</p>
                <div className="flex items-end gap-2">
                  <FormField label="Agreed fee (optional)" className="flex-1">
                    <MoneyInput value={addFeePaise} onChange={setAddFeePaise} placeholder="0" />
                  </FormField>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={addMember.isPending || addFreelancer.isPending}
                    onClick={() => void addToProject()}
                  >
                    Add to project
                  </Button>
                </div>
              </div>
            )}

            <FormField label="Amount" required error={errors.amountPaise}>
              <MoneyInput
                value={form.amountPaise}
                onChange={(v) => set('amountPaise', v)}
                invalid={!!errors.amountPaise}
                placeholder="0"
              />
              {balance && onProject && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pendingNow > 0 && (
                    <Chip onClick={() => set('amountPaise', pendingNow)}>Pay pending <Price paise={pendingNow} /></Chip>
                  )}
                  {agreed > 0 && pendingNow > 0 && pendingNow !== agreed && (
                    <Chip onClick={() => set('amountPaise', Math.round(pendingNow / 2))}>Half <Price paise={Math.round(pendingNow / 2)} /></Chip>
                  )}
                </div>
              )}
            </FormField>

            {balance && onProject && form.projectId !== NO_PROJECT && (
              <div
                className={cn(
                  'rounded-md border px-3 py-2 text-xs',
                  overAgreed ? 'border-warning/40 bg-warning/5' : 'bg-muted/40',
                )}
              >
                {agreed > 0 ? (
                  <>
                    <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', overAgreed ? 'bg-warning' : 'bg-primary')}
                        style={{ width: `${Math.min(100, (paidAfter / agreed) * 100)}%` }}
                      />
                    </div>
                    <p>
                      After this: <strong><Price paise={paidAfter} /></strong> paid of <Price paise={agreed} /> agreed
                      {overAgreed ? (
                        <span className="text-warning"> — <Price paise={paidAfter - agreed} /> over the agreed fee</span>
                      ) : (
                        <> · <Price paise={Math.max(0, agreed - paidAfter)} /> still pending</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    No agreed fee set for {payeeName} on this project. Paid so far: <Price paise={balance.paidPaise - alreadyCounted} />.
                  </p>
                )}
              </div>
            )}

            {duplicate && (
              <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Possible duplicate: <Price paise={duplicate.amountPaise} /> to {payeeName} is already logged for {formatDate(duplicate.paidAt)}
                  {duplicate.reference ? ` (ref ${duplicate.reference})` : ''}. Save anyway only if this is a second payment.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date paid" required error={errors.paidAt}>
                <Input type="date" value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} aria-invalid={!!errors.paidAt} />
                <div className="flex gap-1.5 pt-1">
                  <Chip active={form.paidAt === todayLocal()} onClick={() => set('paidAt', todayLocal())}>Today</Chip>
                  <Chip active={form.paidAt === yesterday()} onClick={() => set('paidAt', yesterday())}>Yesterday</Chip>
                </div>
              </FormField>
              <FormField label="Method">
                <Select value={form.method} onChange={(e) => set('method', e.target.value as PayoutMethod)}>
                  {Object.values(PayoutMethod).map((m) => (
                    <option key={m} value={m}>
                      {PAYOUT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Reference" hint="UTR, UPI or cheque number">
                <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Optional" maxLength={120} />
              </FormField>
              <FormField label="Type">
                <Select value={form.category} onChange={(e) => set('category', e.target.value as PayoutCategory)}>
                  {Object.values(PayoutCategory).map((c) => (
                    <option key={c} value={c}>
                      {PAYOUT_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Note" hint={payeeType === PayeeType.MEMBER ? `${payeeName} can see this note in their earnings.` : undefined}>
              <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Second milestone, design phase" maxLength={500} />
            </FormField>
          </SheetBody>

          <SheetFooter className={cn(editId && 'justify-between')}>
            {editId && (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deletePayment()} disabled={busy}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              {!editId && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>
                  Save &amp; log another
                </Button>
              )}
              <Button type="submit" disabled={busy || (!!editId && !editing.data)}>
                {busy ? 'Saving…' : editId ? 'Save changes' : 'Log payment'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] transition-colors hover:border-foreground/30 hover:bg-accent',
        active && 'border-primary/40 bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}
