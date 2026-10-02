// CRM pipeline — deals by stage, weighted forecast, and what to do when a deal is won (OWNER-only).
'use client';

import { CalendarClock, ChevronRight, FileSignature, FolderPlus, Handshake, Plus, Trash2, Trophy, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CRM_OPEN_STAGES, CRM_STAGE_LABEL, CRM_STAGE_ORDER, CRM_STAGE_PROBABILITY, CrmStage, Role, SUPPORTED_CURRENCIES } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { thisMonthLocal, toLocalDateInput, todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { FilterBar, SearchFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import {
  useClients,
  useConvertOpportunityToClient,
  useCreateOpportunity,
  useDeleteOpportunity,
  useMoveOpportunity,
  usePipeline,
  useUpdateOpportunity,
  type OpportunityBody,
  type OpportunityRow,
} from '@/features/clients/clients.hooks';
import { formatTotals, totalsByCurrency } from '@/features/contracts/contract-utils';

export default function CrmPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

const isOpen = (s: CrmStage) => (CRM_OPEN_STAGES as readonly CrmStage[]).includes(s);
const probabilityOf = (o: OpportunityRow) => o.probability ?? CRM_STAGE_PROBABILITY[o.stage];
const isOverdue = (o: OpportunityRow) => isOpen(o.stage) && !!o.expectedCloseDate && o.expectedCloseDate.slice(0, 10) < todayLocal();
const money = (m: Map<string, number>) => formatTotals(m, formatPaise);

const STAGE_TONE: Record<CrmStage, string> = {
  [CrmStage.LEAD]: 'bg-muted-foreground/40',
  [CrmStage.QUALIFIED]: 'bg-sky-500',
  [CrmStage.PROPOSAL]: 'bg-violet-500',
  [CrmStage.NEGOTIATION]: 'bg-amber-500',
  [CrmStage.WON]: 'bg-[hsl(var(--success))]',
  [CrmStage.LOST]: 'bg-destructive/60',
};

function Inner() {
  const confirm = useConfirm();
  const list = useListState('crm', { q: '' });
  const pipeline = usePipeline();
  const clients = useClients();
  const move = useMoveOpportunity();
  const del = useDeleteOpportunity();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OpportunityRow | null>(null);
  const [wonId, setWonId] = useState<string | null>(null);
  const [losing, setLosing] = useState<OpportunityRow | null>(null);
  useNewParam(() => {
    setEditing(null);
    setFormOpen(true);
  });

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c._id, c.name])), [clients.data]);
  const companyOf = (o: OpportunityRow): { label: string; prospect: boolean; missing: boolean } => {
    if (o.clientId) {
      const name = clientName.get(o.clientId);
      return { label: name ?? (clients.isLoading ? '…' : 'Deleted client'), prospect: false, missing: !name && !clients.isLoading };
    }
    return { label: o.prospectName || 'No company', prospect: true, missing: false };
  };

  const all = pipeline.data ?? [];
  const q = list.params.q.trim().toLowerCase();
  const deals = q ? all.filter((o) => `${o.title} ${companyOf(o).label}`.toLowerCase().includes(q)) : all;
  const byStage = useMemo(() => {
    const m = new Map<CrmStage, OpportunityRow[]>(CRM_STAGE_ORDER.map((s) => [s, []]));
    for (const o of deals) m.get(o.stage)?.push(o);
    for (const rows of m.values()) rows.sort((a, b) => a.position - b.position);
    return m;
  }, [deals]);

  const open = all.filter((o) => isOpen(o.stage));
  const month = thisMonthLocal();
  const wonThisMonth = all.filter((o) => o.stage === CrmStage.WON && toLocalDateInput(o.closedAt ?? o.updatedAt ?? o.createdAt ?? new Date()).slice(0, 7) === month);
  const overdue = open.filter(isOverdue);

  const changeStage = (o: OpportunityRow, stage: CrmStage) => {
    if (stage === o.stage) return;
    if (stage === CrmStage.LOST) {
      setLosing(o);
      return;
    }
    move.mutate({ id: o._id, body: { stage } });
    if (stage === CrmStage.WON) setWonId(o._id);
  };

  const remove = async (o: OpportunityRow) => {
    const ok = await confirm({ title: `Delete “${o.title}”?`, description: 'The deal is removed from the pipeline and from the won/lost history.', confirmText: 'Delete deal', destructive: true });
    if (ok) del.mutate(o._id, { onSuccess: () => setFormOpen(false) });
  };

  const wonDeal = wonId ? all.find((o) => o._id === wonId) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description="Deals by stage — what’s likely to close and what to do when one is won."
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New deal
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open pipeline" loading={pipeline.isLoading} value={money(totalsByCurrency(open, (o) => o.valuePaise, (o) => o.currency))} hint={`${open.length} open deal${open.length === 1 ? '' : 's'}`} />
        <StatCard
          label="Weighted forecast"
          loading={pipeline.isLoading}
          value={money(totalsByCurrency(open, (o) => Math.round((o.valuePaise * probabilityOf(o)) / 100), (o) => o.currency))}
          hint="Value × win chance, open deals"
        />
        <StatCard
          label="Won this month"
          loading={pipeline.isLoading}
          tone={wonThisMonth.length ? 'success' : 'default'}
          value={money(totalsByCurrency(wonThisMonth, (o) => o.valuePaise, (o) => o.currency))}
          hint={`${wonThisMonth.length} deal${wonThisMonth.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Past close date"
          loading={pipeline.isLoading}
          tone={overdue.length ? 'danger' : 'default'}
          value={String(overdue.length)}
          hint={overdue.length ? 'Open deals to follow up' : 'Nothing overdue'}
        />
      </div>

      <FilterBar>
        <SearchFilter value={list.params.q} onChange={(v) => list.set({ q: v })} placeholder="Search deal or company" />
      </FilterBar>

      {pipeline.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CRM_STAGE_ORDER.map((s) => (
            <Skeleton key={s} className="h-48" />
          ))}
        </div>
      ) : pipeline.error ? (
        <ErrorState error={pipeline.error} onRetry={() => pipeline.refetch()} className="rounded-lg border" />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Handshake}
          className="rounded-lg border"
          title="No deals yet"
          description="Add leads as they come in and move them along as they progress."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              Add your first deal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CRM_STAGE_ORDER.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const totals = totalsByCurrency(items, (o) => o.valuePaise, (o) => o.currency);
            const weighted = isOpen(stage) ? totalsByCurrency(items, (o) => Math.round((o.valuePaise * probabilityOf(o)) / 100), (o) => o.currency) : undefined;
            return (
              <section key={stage} className="flex min-w-0 flex-col rounded-lg border bg-muted/20">
                <header className="space-y-0.5 border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', STAGE_TONE[stage])} />
                    <h2 className="text-sm font-medium">{CRM_STAGE_LABEL[stage]}</h2>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <p className="truncate text-xs tabular-nums text-muted-foreground" title={money(totals)}>
                    {items.length ? money(totals) : '—'}
                    {weighted && items.length > 0 && <span className="block">≈ {money(weighted)} weighted</span>}
                  </p>
                </header>
                <div className="flex-1 space-y-2 p-2">
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">No deals</p>}
                  {items.map((o) => (
                    <DealCard
                      key={o._id}
                      deal={o}
                      company={companyOf(o)}
                      onOpen={() => {
                        setEditing(o);
                        setFormOpen(true);
                      }}
                      onStage={(s) => changeStage(o, s)}
                      onWonActions={() => setWonId(o._id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <DealFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        deal={editing ?? undefined}
        onDelete={editing ? () => void remove(editing) : undefined}
        onWon={(id) => setWonId(id)}
      />
      <WonDialog deal={wonDeal} companyName={wonDeal ? companyOf(wonDeal).label : ''} open={!!wonId} onOpenChange={(o) => !o && setWonId(null)} />
      <LostDialog
        deal={losing}
        onOpenChange={(o) => !o && setLosing(null)}
        onConfirm={(reason) => {
          if (losing) move.mutate({ id: losing._id, body: { stage: CrmStage.LOST, lostReason: reason || undefined } });
          setLosing(null);
        }}
      />
    </div>
  );
}

function DealCard({
  deal: o,
  company,
  onOpen,
  onStage,
  onWonActions,
}: {
  deal: OpportunityRow;
  company: { label: string; prospect: boolean; missing: boolean };
  onOpen: () => void;
  onStage: (s: CrmStage) => void;
  onWonActions: () => void;
}) {
  const overdue = isOverdue(o);
  const idx = CRM_STAGE_ORDER.indexOf(o.stage);
  const next = isOpen(o.stage) ? CRM_STAGE_ORDER[idx + 1] : undefined;
  return (
    <article className="group rounded-md border bg-card p-2.5 text-xs shadow-sm transition-colors hover:border-foreground/25">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <p className="text-[13px] font-medium leading-snug group-hover:underline">{o.title}</p>
        <p className={cn('mt-0.5 truncate', company.missing ? 'text-muted-foreground italic' : 'text-muted-foreground')}>
          {company.label}
          {company.prospect && ' · prospect'}
        </p>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-medium tabular-nums">{formatPaise(o.valuePaise, o.currency)}</span>
        {isOpen(o.stage) && (
          <span className="tabular-nums text-muted-foreground" title={o.probability === undefined ? 'Stage default' : 'Win chance'}>
            {probabilityOf(o)}%
          </span>
        )}
      </div>
      {o.expectedCloseDate && isOpen(o.stage) && (
        <p className={cn('mt-1 flex items-center gap-1', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          <CalendarClock className="h-3 w-3" />
          {overdue ? 'Was due ' : 'Close by '}
          {formatDate(o.expectedCloseDate)}
        </p>
      )}
      {o.stage === CrmStage.LOST && o.lostReason && <p className="mt-1 line-clamp-2 text-muted-foreground">Lost: {o.lostReason}</p>}
      {o.stage === CrmStage.WON && o.closedAt && <p className="mt-1 text-muted-foreground">Won {formatDate(o.closedAt)}</p>}
      <div className="mt-2 flex items-center gap-1">
        <Select
          aria-label={`Stage of ${o.title}`}
          className="h-7 flex-1 px-2 text-xs"
          value={o.stage}
          onChange={(e) => onStage(e.target.value as CrmStage)}
        >
          {CRM_STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {CRM_STAGE_LABEL[s]}
            </option>
          ))}
        </Select>
        {next && (
          <button
            type="button"
            title={`Move to ${CRM_STAGE_LABEL[next]}`}
            aria-label={`Move to ${CRM_STAGE_LABEL[next]}`}
            onClick={() => onStage(next)}
            className="rounded border p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        {o.stage === CrmStage.WON && (
          <button
            type="button"
            title="Set up the work"
            aria-label="Set up the work"
            onClick={onWonActions}
            className="rounded border p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// ── Create / edit ────────────────────────────────────────────────────────────────────

interface DealValues {
  mode: 'client' | 'prospect';
  clientId: string;
  prospectName: string;
  title: string;
  valuePaise: number | undefined;
  currency: string;
  stage: CrmStage;
  probability: string;
  expectedCloseDate: string;
  notes: string;
  lostReason: string;
}

const fromDeal = (o?: OpportunityRow): DealValues => ({
  mode: o && !o.clientId ? 'prospect' : 'client',
  clientId: o?.clientId ?? '',
  prospectName: o?.prospectName ?? '',
  title: o?.title ?? '',
  valuePaise: o?.valuePaise,
  currency: o?.currency ?? 'INR',
  stage: o?.stage ?? CrmStage.LEAD,
  probability: o?.probability !== undefined ? String(o.probability) : '',
  expectedCloseDate: o?.expectedCloseDate?.slice(0, 10) ?? '',
  notes: o?.notes ?? '',
  lostReason: o?.lostReason ?? '',
});

function DealFormDialog({
  open,
  onOpenChange,
  deal,
  onDelete,
  onWon,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal?: OpportunityRow;
  onDelete?: () => void;
  onWon: (id: string) => void;
}) {
  const clients = useClients();
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();
  const [v, setV] = useState<DealValues>(() => fromDeal(deal));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setV(fromDeal(deal));
    setErrors({});
    setServerError(undefined);
  }, [open, deal]);

  const clientOptions = useMemo<ComboboxOption[]>(() => {
    const opts = (clients.data ?? []).map((c) => ({ value: c._id, label: c.name }));
    if (v.clientId && !clients.isLoading && !opts.some((o) => o.value === v.clientId)) opts.unshift({ value: v.clientId, label: 'Deleted client' });
    return opts;
  }, [clients.data, clients.isLoading, v.clientId]);

  const set = <K extends keyof DealValues>(k: K, val: DealValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (v.mode === 'client' && !v.clientId) e.clientId = 'Pick a client — or add a prospect';
    if (v.mode === 'prospect' && v.prospectName.trim().length < 2) e.prospectName = 'Enter the company name';
    if (v.title.trim().length < 2) e.title = 'Give the deal a name';
    if (v.valuePaise === undefined) e.valuePaise = 'Enter the deal value';
    if (v.probability !== '' && (Number(v.probability) < 0 || Number(v.probability) > 100)) e.probability = '0–100';
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: OpportunityBody = {
      clientId: v.mode === 'client' ? v.clientId : null,
      prospectName: v.mode === 'prospect' ? v.prospectName.trim() : undefined,
      title: v.title.trim(),
      valuePaise: v.valuePaise ?? 0,
      currency: v.currency,
      stage: v.stage,
      probability: v.probability === '' ? null : Number(v.probability),
      expectedCloseDate: v.expectedCloseDate || null,
      notes: v.notes,
      lostReason: v.stage === CrmStage.LOST ? v.lostReason.trim() : undefined,
    };
    try {
      const saved = deal ? await update.mutateAsync({ id: deal._id, body }) : await create.mutateAsync(body);
      onOpenChange(false);
      if (saved.stage === CrmStage.WON && deal?.stage !== CrmStage.WON) onWon(saved._id);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{deal ? 'Edit deal' : 'New deal'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <FormField label="Deal" required error={errors.title}>
            <Input autoFocus value={v.title} placeholder="e.g. Website redesign" onChange={(e) => set('title', e.target.value)} />
          </FormField>

          {v.mode === 'client' ? (
            <FormField
              label="Client"
              required
              error={errors.clientId}
              hint={
                <button type="button" className="underline" onClick={() => set('mode', 'prospect')}>
                  Not a client yet? Add as a prospect
                </button>
              }
            >
              <Combobox
                options={clientOptions}
                value={v.clientId || undefined}
                onChange={(id) => set('clientId', id ?? '')}
                placeholder="Pick a client"
                searchPlaceholder="Search clients"
                loading={clients.isLoading}
                invalid={!!errors.clientId}
              />
            </FormField>
          ) : (
            <FormField
              label="Prospect company"
              required
              error={errors.prospectName}
              hint={
                <>
                  Becomes a client when the deal is won.{' '}
                  <button type="button" className="underline" onClick={() => set('mode', 'client')}>
                    Pick an existing client instead
                  </button>
                </>
              }
            >
              <Input value={v.prospectName} placeholder="Company name" onChange={(e) => set('prospectName', e.target.value)} />
            </FormField>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <FormField label="Value" required error={errors.valuePaise}>
              <MoneyInput value={v.valuePaise} currency={v.currency} onChange={(p) => set('valuePaise', p)} invalid={!!errors.valuePaise} />
            </FormField>
            <FormField label="Currency">
              <Select value={v.currency} onChange={(e) => set('currency', e.target.value)}>
                {(SUPPORTED_CURRENCIES as readonly string[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Stage">
              <Select value={v.stage} onChange={(e) => set('stage', e.target.value as CrmStage)}>
                {CRM_STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {CRM_STAGE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Win chance %" error={errors.probability} hint={`Empty = ${CRM_STAGE_PROBABILITY[v.stage]}% for this stage`}>
              <Input
                inputMode="numeric"
                value={v.probability}
                placeholder={String(CRM_STAGE_PROBABILITY[v.stage])}
                onChange={(e) => set('probability', e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </FormField>
            <FormField label="Expected close" error={errors.expectedCloseDate}>
              <Input type="date" value={v.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} />
            </FormField>
          </div>

          {v.stage === CrmStage.LOST && (
            <FormField label="Why was it lost?" error={errors.lostReason}>
              <Input value={v.lostReason} placeholder="e.g. Went with a cheaper agency" onChange={(e) => set('lostReason', e.target.value)} />
            </FormField>
          )}

          <FormField label="Notes" error={errors.notes}>
            <Textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormField>

          <DialogFooter className={deal ? 'sm:justify-between' : undefined}>
            {deal && onDelete && (
              <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : deal ? 'Save changes' : 'Add deal'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Won: what next? ──────────────────────────────────────────────────────────────────

function WonDialog({
  deal,
  companyName,
  open,
  onOpenChange,
}: {
  deal?: OpportunityRow;
  companyName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const convert = useConvertOpportunityToClient();
  if (!deal) return null;
  const clientId = deal.clientId;
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const sowHref = clientId
    ? `/sows?new=1&clientId=${clientId}&title=${encodeURIComponent(deal.title)}&value=${deal.valuePaise}&currency=${deal.currency}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[hsl(var(--success))]" /> Deal won — what next?
          </DialogTitle>
          <DialogDescription>
            {deal.title} · {formatPaise(deal.valuePaise, deal.currency)}
            {companyName && ` · ${companyName}`}
          </DialogDescription>
        </DialogHeader>

        {!clientId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {deal.prospectName ? `${deal.prospectName} isn’t a client yet.` : 'This deal has no company.'} Add them as a client to set up a project, SOW or contract.
            </p>
            {deal.prospectName ? (
              <Button className="w-full" onClick={() => convert.mutate(deal._id)} disabled={convert.isPending}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {convert.isPending ? 'Adding…' : `Add ${deal.prospectName} as a client`}
              </Button>
            ) : (
              <Button className="w-full" variant="outline" asChild>
                <Link href="/clients?new=1" onClick={() => onOpenChange(false)}>
                  Add a client
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            <WonOption icon={FolderPlus} title="Create a project" text="Start the work with this client." onClick={() => go(`/projects?new=1&clientId=${clientId}`)} />
            <WonOption icon={FileSignature} title="Write a SOW" text="Scope and payment milestones, pre-filled with the deal value." onClick={() => go(sowHref)} />
            <WonOption icon={Handshake} title="Set up a retainer contract" text="Monthly billing with reminders." onClick={() => go(`/contracts?new=1&clientId=${clientId}`)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WonOption({ icon: Icon, title, text, onClick }: { icon: typeof Trophy; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:border-foreground/25 hover:bg-accent/40">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

// ── Lost: why? ───────────────────────────────────────────────────────────────────────

const LOST_REASONS = ['Price', 'Timing', 'Went with someone else', 'No response', 'Scope didn’t fit'];

function LostDialog({ deal, onOpenChange, onConfirm }: { deal: OpportunityRow | null; onOpenChange: (o: boolean) => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (deal) setReason(deal.lostReason ?? '');
  }, [deal]);
  return (
    <Dialog open={!!deal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark “{deal?.title}” as lost?</DialogTitle>
          <DialogDescription>A short reason helps spot patterns later. Optional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {LOST_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}>
                <Badge variant={reason === r ? 'default' : 'outline'}>{r}</Badge>
              </button>
            ))}
          </div>
          <Input autoFocus value={reason} placeholder="Why was it lost?" maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim())}>
            Mark as lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
