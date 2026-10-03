// Project money (OWNER) — the commercial picture and the billing journey.
//  - ProjectMoneySummary: budget split into collected / billed / not yet billed, cash in hand and
//    planned margin.
//  - ProjectMilestones: milestones and invoices as one journey, with "Invoice this milestone",
//    "Mark collected", add and remove.
'use client';

import { FileText, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  Bento,
  BigNumber,
  formatCompact,
  journeyFromMilestones,
  Legend,
  MilestoneJourney,
  Price,
  SegmentBar,
  Tile,
  useCanSeePrices,
  type JourneyStep,
} from '@/components/viz';
import { useCreateInvoice, useInvoices, type InvoiceRow } from '@/features/invoices/invoices.hooks';

import {
  useAddMilestone,
  useProjectBalance,
  useRemoveMilestone,
  useUpdateMilestone,
  type MilestoneRow,
  type ProjectRow,
} from '../projects.hooks';

const STATE_COLOR = {
  collected: 'hsl(var(--success))',
  invoiced: 'hsl(var(--info))',
  late: 'hsl(var(--destructive))',
  pending: 'hsl(var(--muted-foreground) / 0.45)',
};

export function ProjectMoneySummary({ project }: { project: ProjectRow }) {
  const balance = useProjectBalance(project._id);
  const canSee = useCanSeePrices();
  const cur = project.currency ?? 'INR';
  const b = balance.data;

  if (balance.isError) {
    return (
      <div className="rounded-[var(--radius)] border bg-card">
        <ErrorState title="Couldn't load the project figures" error={balance.error} onRetry={() => balance.refetch()} />
      </div>
    );
  }
  if (!b) {
    return (
      <Bento>
        <Tile span={8}>
          <Skeleton className="h-28 w-full" />
        </Tile>
        <Tile span={4}>
          <Skeleton className="h-28 w-full" />
        </Tile>
      </Bento>
    );
  }

  const billedOpen = Math.max(0, b.invoicedPaise - b.collectedPaise);
  const unbilled = Math.max(0, b.budgetPaise - b.invoicedPaise);
  const marginPct = b.budgetPaise > 0 ? Math.round((b.plannedMarginPaise / b.budgetPaise) * 100) : undefined;
  const show = (paise: number) => (canSee ? formatCompact(paise, cur) : '');

  return (
    <Bento>
      <Tile span={8} title="Where the budget stands">
        {b.budgetPaise === 0 && b.invoicedPaise === 0 ? (
          <p className="text-sm text-muted-foreground">No budget set yet. Add one in Edit project to see how much is billed and collected.</p>
        ) : (
          <div className="space-y-3">
            <SegmentBar
              segments={[
                { value: Math.min(b.collectedPaise, b.invoicedPaise || b.collectedPaise), color: STATE_COLOR.collected, label: 'Collected', display: show(b.collectedPaise) },
                { value: billedOpen, color: STATE_COLOR.invoiced, label: 'Billed, not collected', display: show(billedOpen) },
                { value: unbilled, color: 'hsl(var(--muted-foreground) / 0.35)', label: 'Not billed yet', display: show(unbilled) },
              ]}
            />
            <Legend
              items={[
                { color: STATE_COLOR.collected, label: <>Collected <Price paise={b.collectedPaise} currency={cur} /></> },
                { color: STATE_COLOR.invoiced, label: <>Billed, not collected <Price paise={billedOpen} currency={cur} /></> },
                { color: 'hsl(var(--muted-foreground) / 0.35)', label: <>Not billed yet <Price paise={unbilled} currency={cur} /></> },
              ]}
            />
            {b.budgetPaise > 0 && b.invoicedPaise > b.budgetPaise && (
              <p className="text-xs text-warning">
                Billed <Price paise={b.invoicedPaise - b.budgetPaise} currency={cur} /> more than the budget.
              </p>
            )}
          </div>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Fig label="Budget">{b.budgetPaise ? <Price paise={b.budgetPaise} currency={cur} /> : 'Not set'}</Fig>
          <Fig label="Invoiced" href={`/invoices?projectId=${project._id}`}>
            <Price paise={b.invoicedPaise} currency={cur} />
          </Fig>
          <Fig label="Collected">
            <Price paise={b.collectedPaise} currency={cur} className="text-success" />
          </Fig>
          <Fig label="Paid out" href={`/payments?projectId=${project._id}`}>
            <Price paise={b.disbursedPaise} currency={cur} />
          </Fig>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Paid out: team <Price paise={b.teamPaidPaise} currency={cur} /> · freelancers <Price paise={b.freelancerPaidPaise} currency={cur} />
        </p>
      </Tile>
      <Tile span={4} tone="ink" title="Cash in hand">
        <BigNumber caption="Collected from the client, minus what you've paid out">
          <Price paise={b.inHandPaise} currency={cur} className={b.inHandPaise < 0 ? 'text-destructive' : 'text-brand'} />
        </BigNumber>
        <div className="mt-5 border-t border-background/15 pt-3 text-sm">
          <p className="text-background/70">Planned margin</p>
          <p className="font-figures text-lg font-semibold">
            <Price paise={b.plannedMarginPaise} currency={cur} className={b.plannedMarginPaise < 0 ? 'text-destructive' : undefined} />
            {marginPct !== undefined && <span className="ml-1.5 text-xs font-normal text-background/70">{marginPct}% of budget</span>}
          </p>
          <p className="mt-0.5 text-xs text-background/60">Budget minus every agreed fee</p>
        </div>
      </Tile>
    </Bento>
  );
}

function Fig({ label, href, children }: { label: string; href?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{href ? <Link href={href} className="hover:text-foreground hover:underline">{label}</Link> : label}</dt>
      <dd className="font-figures text-base font-semibold">{children}</dd>
    </div>
  );
}

/** Journey steps with amounts (OWNER). */
export function ownerJourneySteps(project: ProjectRow): JourneyStep[] {
  const cur = project.currency ?? 'INR';
  const today = todayLocal();
  return journeyFromMilestones(project.milestones ?? []).map(({ item: m, state }) => ({
    key: m._id,
    title: m.name,
    state,
    caption: (
      <>
        <Price paise={m.amountPaise ?? 0} currency={cur} compact />
        {' · '}
        {m.status === 'COLLECTED'
          ? 'collected'
          : m.status === 'INVOICED'
            ? 'invoiced'
            : m.dueDate
              ? m.dueDate.slice(0, 10) < today
                ? `was due ${formatDate(m.dueDate, { day: 'numeric', month: 'short' })}`
                : formatDate(m.dueDate, { day: 'numeric', month: 'short' })
              : 'not billed'}
      </>
    ),
  }));
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
  const linkedIds = new Set(milestones.map((m) => m.invoiceId).filter(Boolean));
  const looseInvoices = (invoices.data ?? [])
    .filter((i) => !linkedIds.has(i._id))
    .sort((a, b) => (a.issueDate ?? a.createdAt ?? '').localeCompare(b.issueDate ?? b.createdAt ?? ''));
  const scheduled = milestones.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
  const budget = project.clientBudgetPaise ?? 0;
  const today = todayLocal();

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

  const stateOf = (ms: MilestoneRow) =>
    ms.status === 'COLLECTED' ? 'collected' : ms.status === 'INVOICED' ? 'invoiced' : ms.dueDate && ms.dueDate.slice(0, 10) < today ? 'late' : 'pending';

  return (
    <Tile
      span={12}
      title="Billing journey"
      action={
        !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add milestone
          </Button>
        )
      }
    >
      <p className="-mt-1 mb-4 text-[13px] text-muted-foreground">
        <Price paise={scheduled} currency={cur} /> scheduled in {milestones.length} milestone{milestones.length === 1 ? '' : 's'}
        {budget > 0 && scheduled !== budget && (
          <span className={cn(scheduled > budget ? 'text-destructive' : 'text-warning')}>
            {' '}· <Price paise={Math.abs(budget - scheduled)} currency={cur} /> {scheduled > budget ? 'over' : 'not yet scheduled'} vs budget
          </span>
        )}
      </p>

      {!project.clientId && (
        <p className="mb-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          This project has no client, so milestones can&apos;t be invoiced. Link a client in Edit project to bill it.
        </p>
      )}

      {milestones.length > 0 && <MilestoneJourney steps={ownerJourneySteps(project)} className="mb-6" />}

      {milestones.length === 0 && looseInvoices.length === 0 && !adding && (
        <EmptyState
          illustration="money"
          title="No milestones yet"
          description="Split the budget into payment milestones (advance, design, launch…) to track what's billed and collected."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add the first milestone
            </Button>
          }
          className="py-8"
        />
      )}

      {(milestones.length > 0 || looseInvoices.length > 0) && (
        <ol className="relative space-y-3 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-0.5 before:rounded before:bg-border">
          {milestones.map((ms) => {
            const inv = ms.invoiceId ? invoiceById.get(ms.invoiceId) : undefined;
            const state = stateOf(ms);
            return (
              <li key={ms._id} className="relative">
                <span className="absolute -left-6 top-3.5 h-4 w-4 rounded-full border-2 border-card" style={{ background: STATE_COLOR[state] }} aria-hidden />
                <div className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{ms.name}</span>
                        <StatusBadge status={ms.status} />
                        {ms.dueDate && (
                          <span className={cn('text-xs', state === 'late' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                            {state === 'late' ? 'Was due' : 'Due'} {formatDate(ms.dueDate)}
                          </span>
                        )}
                      </div>
                      {ms.note && <p className="mt-0.5 text-xs text-muted-foreground">{ms.note}</p>}
                    </div>
                    <Price paise={ms.amountPaise ?? 0} currency={cur} className="text-sm font-semibold" />
                    <div className="flex items-center gap-1">
                      {ms.status === 'PENDING' && project.clientId && (ms.amountPaise ?? 0) > 0 && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={createInvoice.isPending} onClick={() => void invoiceMilestone(ms)}>
                          <FileText className="mr-1 h-3.5 w-3.5" /> Invoice this
                        </Button>
                      )}
                      {ms.status === 'INVOICED' && !inv && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={updateMilestone.isPending}
                          onClick={() => updateMilestone.mutate({ id: project._id, milestoneId: ms._id, body: { status: 'COLLECTED' } })}
                        >
                          Mark collected
                        </Button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${ms.name}`}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Remove "${ms.name}"?`,
                            description: inv ? `It's linked to invoice ${inv.number}; the invoice itself is kept.` : 'It comes off the billing schedule. Nothing else changes.',
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
                  {inv ? <LinkedInvoice inv={inv} /> : ms.invoiceId && !invoices.isLoading ? <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Linked invoice was deleted.</p> : null}
                </div>
              </li>
            );
          })}
          {looseInvoices.length > 0 && (
            <>
              <li className="relative pt-2 text-xs font-medium text-muted-foreground">Invoices outside the milestones</li>
              {looseInvoices.map((inv) => (
                <li key={inv._id} className="relative">
                  <span
                    className="absolute -left-6 top-3 h-4 w-4 rounded-full border-2 border-card"
                    style={{ background: inv.status === 'PAID' ? STATE_COLOR.collected : inv.isOverdue ? STATE_COLOR.late : STATE_COLOR.invoiced }}
                    aria-hidden
                  />
                  <div className="rounded-xl border border-dashed p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/invoices/${inv._id}`} className="font-figures font-semibold hover:underline">
                        {inv.number}
                      </Link>
                      <StatusBadge status={inv.isOverdue && inv.status !== 'PAID' ? 'OVERDUE' : inv.status} />
                      {inv.issueDate && <span className="text-xs text-muted-foreground">Issued {formatDate(inv.issueDate)}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        <Price paise={inv.paidPaise} currency={inv.currency} /> of <Price paise={inv.totalPaise} currency={inv.currency} /> received
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </>
          )}
        </ol>
      )}
      {invoices.isError && <p className="mt-3 text-xs text-destructive">Couldn&apos;t load this project&apos;s invoices — refresh to try again.</p>}

      {adding && (
        <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px]">
            <FormField label="Milestone" error={errors.name}>
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 30% advance" />
            </FormField>
            <FormField label="Amount" error={errors.amountPaise}>
              <MoneyInput value={draft.amountPaise} onChange={(v) => setDraft({ ...draft, amountPaise: v })} currency={cur} />
              {budget > scheduled && (
                <div className="flex gap-1 pt-1">
                  {[30, 50].map((pctOf) => (
                    <button
                      key={pctOf}
                      type="button"
                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent"
                      onClick={() => setDraft({ ...draft, amountPaise: Math.round((budget * pctOf) / 100) })}
                    >
                      {pctOf}%
                    </button>
                  ))}
                  <button type="button" className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent" onClick={() => setDraft({ ...draft, amountPaise: budget - scheduled })}>
                    Rest
                  </button>
                </div>
              )}
            </FormField>
            <FormField label="Due date">
              <Input
                type="date"
                value={draft.dueDate}
                min={toLocalDateInput(new Date(Date.now() - 365 * 86_400_000))}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Note">
            <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Optional" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setErrors({});
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={addMilestone.isPending}>
              {addMilestone.isPending ? 'Adding…' : 'Add milestone'}
            </Button>
          </div>
        </div>
      )}
    </Tile>
  );
}

function LinkedInvoice({ inv }: { inv: InvoiceRow }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
      <Link href={`/invoices/${inv._id}`} className="font-figures font-medium text-brand-ink hover:underline">
        {inv.number}
      </Link>
      <StatusBadge status={inv.isOverdue && inv.status !== 'PAID' ? 'OVERDUE' : inv.status} />
      <span className="text-muted-foreground">
        <Price paise={inv.paidPaise} currency={inv.currency} /> of <Price paise={inv.totalPaise} currency={inv.currency} /> received
      </span>
    </div>
  );
}
