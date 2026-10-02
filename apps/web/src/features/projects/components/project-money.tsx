// Project money (OWNER) — the commercial picture: budget, invoiced, collected, paid out, margin,
// and the milestone billing schedule with one-click "Invoice this milestone".
'use client';

import { FileText, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { toLocalDateInput } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { useCreateInvoice, useInvoices, type InvoiceRow } from '@/features/invoices/invoices.hooks';

import {
  useAddMilestone,
  useProjectBalance,
  useRemoveMilestone,
  useUpdateMilestone,
  type MilestoneRow,
  type ProjectRow,
} from '../projects.hooks';

export function ProjectMoneySummary({ project }: { project: ProjectRow }) {
  const balance = useProjectBalance(project._id);
  const cur = project.currency ?? 'INR';
  const b = balance.data;
  const loading = balance.isLoading;
  const marginPct = b && b.budgetPaise > 0 ? Math.round((b.plannedMarginPaise / b.budgetPaise) * 100) : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Client budget" loading={loading} value={formatPaise(b?.budgetPaise ?? 0, cur)} />
      <StatCard
        label="Invoiced"
        loading={loading}
        value={formatPaise(b?.invoicedPaise ?? 0, cur)}
        hint={b && b.budgetPaise > 0 ? `${Math.round((b.invoicedPaise / b.budgetPaise) * 100)}% of budget` : undefined}
        href={`/invoices?projectId=${project._id}`}
      />
      <StatCard label="Collected" tone="success" loading={loading} value={formatPaise(b?.collectedPaise ?? 0, cur)} />
      <StatCard
        label="Paid out"
        loading={loading}
        value={formatPaise(b?.disbursedPaise ?? 0, cur)}
        hint={b ? `Team ${formatPaise(b.teamPaidPaise, cur)} · freelancers ${formatPaise(b.freelancerPaidPaise, cur)}` : undefined}
        href={`/payments?projectId=${project._id}`}
      />
      <StatCard
        label="Cash in hand"
        tone={b && b.inHandPaise < 0 ? 'danger' : 'default'}
        loading={loading}
        value={formatPaise(b?.inHandPaise ?? 0, cur)}
        hint="Collected − paid out"
      />
      <StatCard
        label="Planned margin"
        tone={b && b.plannedMarginPaise < 0 ? 'danger' : 'success'}
        loading={loading}
        value={formatPaise(b?.plannedMarginPaise ?? 0, cur)}
        hint={marginPct !== undefined ? `${marginPct}% · budget − agreed fees` : 'Budget − agreed fees'}
      />
    </div>
  );
}

export function ProjectMilestones({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const confirm = useConfirm();
  const invoices = useInvoices({ projectId: project._id });
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const removeMilestone = useRemoveMilestone();
  const createInvoice = useCreateInvoice();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; amountPaise?: number; dueDate: string; note: string }>({
    name: '',
    dueDate: '',
    note: '',
  });
  const [errors, setErrors] = useState<{ name?: string; amountPaise?: string }>({});
  const cur = project.currency ?? 'INR';
  const invoiceById = new Map((invoices.data ?? []).map((i) => [i._id, i]));
  const milestones = project.milestones ?? [];
  const scheduled = milestones.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
  const budget = project.clientBudgetPaise ?? 0;

  const save = async () => {
    const e: typeof errors = {};
    if (!draft.name.trim()) e.name = 'Name the milestone';
    if (draft.amountPaise === undefined) e.amountPaise = 'Enter an amount';
    setErrors(e);
    if (Object.keys(e).length) return;
    await addMilestone.mutateAsync({
      id: project._id,
      name: draft.name.trim(),
      amountPaise: draft.amountPaise!,
      dueDate: draft.dueDate || undefined,
      note: draft.note || undefined,
    });
    setDraft({ name: '', dueDate: '', note: '' });
    setAdding(false);
  };

  const invoiceMilestone = async (ms: MilestoneRow) => {
    if (!project.clientId) return;
    const inv = await createInvoice.mutateAsync({
      clientId: project.clientId,
      projectId: project._id,
      currency: cur,
      issueDate: new Date(),
      // Due date comes from the client's payment terms (server default).
      lineItems: [
        {
          description: `${project.name} — ${ms.name}`,
          qty: 1,
          unitPaise: ms.amountPaise ?? 0,
          projectId: project._id,
          milestoneId: ms._id,
        },
      ],
    } as never);
    router.push(`/invoices/${inv._id}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Billing milestones</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {formatPaise(scheduled, cur)} scheduled
            {budget > 0 && scheduled !== budget && (
              <span className={cn(scheduled > budget ? 'text-destructive' : 'text-amber-700 dark:text-amber-500')}>
                {' '}· {formatPaise(Math.abs(budget - scheduled), cur)} {scheduled > budget ? 'over' : 'not yet scheduled'} vs budget
              </span>
            )}
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add milestone
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!project.clientId && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            This project has no client, so milestones can&apos;t be invoiced. Link a client in Edit project to bill it.
          </p>
        )}
        {milestones.length === 0 && !adding && (
          <EmptyState
            title="No milestones yet"
            description="Split the budget into payment milestones (advance, design, launch…) to track what's billed and collected."
            className="py-8"
          />
        )}
        {milestones.map((ms) => {
          const inv = ms.invoiceId ? invoiceById.get(ms.invoiceId) : undefined;
          const overdue = ms.status === 'PENDING' && ms.dueDate && new Date(ms.dueDate) < new Date();
          return (
            <div key={ms._id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{ms.name}</span>
                    <StatusBadge status={ms.status} />
                    {ms.dueDate && (
                      <span className={cn('text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {overdue ? 'Was due' : 'Due'} {formatDate(ms.dueDate)}
                      </span>
                    )}
                  </div>
                  {ms.note && <p className="mt-0.5 text-xs text-muted-foreground">{ms.note}</p>}
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatPaise(ms.amountPaise ?? 0, cur)}</span>
                <div className="flex items-center gap-1">
                  {ms.status === 'PENDING' && project.clientId && (ms.amountPaise ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      disabled={createInvoice.isPending}
                      onClick={() => void invoiceMilestone(ms)}
                    >
                      <FileText className="mr-1 h-3.5 w-3.5" /> Invoice this
                    </Button>
                  )}
                  {ms.status === 'INVOICED' && !inv && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateMilestone.mutate({ id: project._id, milestoneId: ms._id, body: { status: 'COLLECTED' } })}>
                      Mark collected
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label="Remove milestone"
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Remove "${ms.name}"?`,
                        description: inv ? `It's linked to invoice ${inv.number}; the invoice itself is kept.` : undefined,
                        destructive: true,
                        confirmText: 'Remove',
                      });
                      if (ok) removeMilestone.mutate({ id: project._id, milestoneId: ms._id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {inv && <LinkedInvoice inv={inv} />}
            </div>
          );
        })}

        {adding && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px]">
              <FormField label="Milestone" error={errors.name}>
                <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 30% advance" />
              </FormField>
              <FormField label="Amount" error={errors.amountPaise}>
                <MoneyInput value={draft.amountPaise} onChange={(v) => setDraft({ ...draft, amountPaise: v })} currency={cur} />
                {budget > scheduled && (
                  <div className="flex gap-1 pt-1">
                    {[30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent"
                        onClick={() => setDraft({ ...draft, amountPaise: Math.round((budget * pct) / 100) })}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent"
                      onClick={() => setDraft({ ...draft, amountPaise: budget - scheduled })}
                    >
                      Rest
                    </button>
                  </div>
                )}
              </FormField>
              <FormField label="Due date">
                <Input type="date" value={draft.dueDate} min={toLocalDateInput(new Date(Date.now() - 365 * 86_400_000))} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Note">
              <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Optional" />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={addMilestone.isPending}>
                {addMilestone.isPending ? 'Adding…' : 'Add milestone'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkedInvoice({ inv }: { inv: InvoiceRow }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
      <Link href={`/invoices/${inv._id}`} className="font-medium text-primary hover:underline">
        {inv.number}
      </Link>
      <StatusBadge status={inv.status} />
      <span className="text-muted-foreground">
        {formatPaise(inv.paidPaise, inv.currency)} of {formatPaise(inv.totalPaise, inv.currency)} received
      </span>
    </div>
  );
}
