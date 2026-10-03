// CRM pipeline — deals by stage, weighted forecast, and what to do when a deal is won (OWNER-only).
'use client';

import { CalendarClock, ChevronRight, FileSignature, FolderPlus, GripVertical, Handshake, LayoutGrid, Plus, Rows3, Trash2, Trophy, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CRM_OPEN_STAGES, CRM_STAGE_LABEL, CRM_STAGE_ORDER, CRM_STAGE_PROBABILITY, CrmStage, Role, SUPPORTED_CURRENCIES } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { csvMoney } from '@/lib/csv';
import { thisMonthLocal, toLocalDateInput, todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { ExportButton, FilterBar, SearchFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
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
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { BigNumber, Bento, Hero, HeroFigure, HeroMark, Legend, Price, PrivacyChip, SegmentBar, Tile, useCanSeePrices } from '@/components/viz';
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
import { monthLabel, totalsByCurrency } from '@/features/contracts/contract-utils';
import { ClientChip, PriceTotals } from '@/features/contracts/price-totals';

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
const weightedOf = (o: OpportunityRow) => Math.round((o.valuePaise * probabilityOf(o)) / 100);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Stage colour (token-based, works in both themes). */
const STAGE_COLOR: Record<CrmStage, string> = {
  [CrmStage.LEAD]: 'hsl(var(--muted-foreground) / 0.55)',
  [CrmStage.QUALIFIED]: 'hsl(var(--info))',
  [CrmStage.PROPOSAL]: 'hsl(var(--p4))',
  [CrmStage.NEGOTIATION]: 'hsl(var(--warning))',
  [CrmStage.WON]: 'hsl(var(--success))',
  [CrmStage.LOST]: 'hsl(var(--destructive) / 0.6)',
};

type Company = { label: string; clientId?: string; prospect: boolean; missing: boolean; loading: boolean };

function Inner() {
  const confirm = useConfirm();
  const canSee = useCanSeePrices();
  const list = useListState('crm', { q: '', view: 'board', sort: '' });
  const view = list.params.view === 'table' ? 'table' : 'board';
  const pipeline = usePipeline();
  const clients = useClients();
  const move = useMoveOpportunity();
  const del = useDeleteOpportunity();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OpportunityRow | null>(null);
  const [wonId, setWonId] = useState<string | null>(null);
  const [losing, setLosing] = useState<OpportunityRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<CrmStage | null>(null);
  useNewParam(() => {
    setEditing(null);
    setFormOpen(true);
  });

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c._id, c.name])), [clients.data]);
  const companyOf = (o: OpportunityRow): Company => {
    if (o.clientId) {
      const name = clientName.get(o.clientId);
      return {
        label: name ?? (clients.isLoading ? '…' : 'Deleted client'),
        clientId: o.clientId,
        prospect: false,
        missing: !name && !clients.isLoading,
        loading: clients.isLoading,
      };
    }
    return { label: o.prospectName || 'No company', prospect: true, missing: false, loading: false };
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
  const openTotals = totalsByCurrency(open, (o) => o.valuePaise, (o) => o.currency);
  const weightedTotals = totalsByCurrency(open, weightedOf, (o) => o.currency);
  const wonTotals = totalsByCurrency(wonThisMonth, (o) => o.valuePaise, (o) => o.currency);

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

  const openDeal = (o: OpportunityRow) => {
    setEditing(o);
    setFormOpen(true);
  };
  const newDeal = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const wonDeal = wonId ? all.find((o) => o._id === wonId) : undefined;

  const columns: Column<OpportunityRow>[] = [
    {
      id: 'title',
      header: 'Deal',
      sortable: true,
      sortValue: (o) => o.title.toLowerCase(),
      cell: (o) => (
        <button type="button" onClick={() => openDeal(o)} className="text-left font-medium hover:underline">
          {o.title}
        </button>
      ),
      csv: (o) => o.title,
    },
    {
      id: 'company',
      header: 'Company',
      sortable: true,
      sortValue: (o) => companyOf(o).label.toLowerCase(),
      cell: (o) => <CompanyLabel company={companyOf(o)} />,
      csv: (o) => companyOf(o).label,
    },
    {
      id: 'stage',
      header: 'Stage',
      sortable: true,
      sortValue: (o) => CRM_STAGE_ORDER.indexOf(o.stage),
      cell: (o) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLOR[o.stage] }} />
          {CRM_STAGE_LABEL[o.stage]}
        </span>
      ),
      csv: (o) => CRM_STAGE_LABEL[o.stage],
    },
    {
      id: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (o) => o.valuePaise,
      cell: (o) => <Price paise={o.valuePaise} currency={o.currency} />,
      csv: (o) => (canSee ? csvMoney(o.valuePaise) : ''),
    },
    { id: 'currency', header: 'Currency', cell: () => null, className: 'hidden', csv: (o) => o.currency },
    {
      id: 'chance',
      header: 'Win chance',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      sortValue: (o) => (isOpen(o.stage) ? probabilityOf(o) : -1),
      cell: (o) => (isOpen(o.stage) ? <span className="font-figures">{probabilityOf(o)}%</span> : <span className="text-muted-foreground">—</span>),
      csv: (o) => (isOpen(o.stage) ? probabilityOf(o) : ''),
    },
    {
      id: 'close',
      header: 'Expected close',
      hideBelow: 'md',
      sortable: true,
      sortValue: (o) => o.expectedCloseDate ?? '',
      cell: (o) =>
        o.stage === CrmStage.WON && o.closedAt ? (
          <span className="text-muted-foreground">Won {formatDate(o.closedAt)}</span>
        ) : o.expectedCloseDate ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className={isOverdue(o) ? 'text-destructive' : undefined}>{formatDate(o.expectedCloseDate)}</span>
            {isOverdue(o) && <Badge variant="danger">Overdue</Badge>}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      csv: (o) => o.expectedCloseDate?.slice(0, 10) ?? '',
    },
  ];
  const visibleColumns = columns.filter((c) => c.className !== 'hidden');
  const sortedDeals = sortRows(deals, columns, list.sort);

  // Open-deal mix by stage — counts, so it reads the same whatever the currencies.
  const stageMix = CRM_OPEN_STAGES.map((s) => ({ stage: s, count: open.filter((o) => o.stage === s).length }));

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Pipeline"
        eyebrow={`Pipeline · ${monthLabel(month)}`}
        loading={pipeline.isLoading}
        aside={
          <>
            {all.length > 0 && <PrivacyChip>Only you see these figures</PrivacyChip>}
            <Button size="sm" variant="brand" onClick={newDeal}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New deal
            </Button>
          </>
        }
        lede={
          pipeline.error ? undefined : all.length === 0 ? (
            'Add leads as they come in and move them along as they progress.'
          ) : (
            <>
              {open.length > 0 && (
                <>
                  Weighted by win chance, that’s about <PriceTotals totals={weightedTotals} compact className="font-medium text-foreground" />.{' '}
                </>
              )}
              {wonThisMonth.length > 0 ? (
                <>
                  Won this month: <PriceTotals totals={wonTotals} compact className="font-medium text-foreground" /> from {wonThisMonth.length}{' '}
                  {plural(wonThisMonth.length, 'deal', 'deals')}.
                </>
              ) : (
                'Nothing won yet this month.'
              )}
            </>
          )
        }
      >
        {pipeline.error ? (
          'Couldn’t load the pipeline.'
        ) : all.length === 0 ? (
          'No deals in the pipeline yet.'
        ) : open.length === 0 ? (
          'No open deals right now — a good moment to chase new leads.'
        ) : (
          <>
            <HeroFigure>
              <PriceTotals totals={openTotals} compact />
            </HeroFigure>{' '}
            in open deals across {open.length} {plural(open.length, 'opportunity', 'opportunities')}
            {overdue.length > 0 ? (
              <>
                {' '}
                — <HeroMark>{overdue.length} {plural(overdue.length, 'is', 'are')}</HeroMark> past {plural(overdue.length, 'its', 'their')} expected close date.
              </>
            ) : (
              '. None are past their close date.'
            )}
          </>
        )}
      </Hero>

      {!pipeline.isLoading && !pipeline.error && open.length > 0 && (
        <Bento>
          <Tile span={8} title="Open deals by stage" action={<span className="text-xs text-muted-foreground">{open.length} open</span>}>
            <SegmentBar
              height="h-8"
              segments={stageMix.map((s) => ({
                value: s.count,
                color: STAGE_COLOR[s.stage],
                label: CRM_STAGE_LABEL[s.stage],
                display: String(s.count),
              }))}
            />
            <Legend className="mt-3" items={stageMix.map((s) => ({ color: STAGE_COLOR[s.stage], label: `${CRM_STAGE_LABEL[s.stage]} · ${s.count}` }))} />
          </Tile>
          <Tile span={4} tone="ink" title="Weighted forecast">
            <BigNumber caption="Deal value × win chance, open deals" className="[&>div]:text-brand">
              <PriceTotals totals={weightedTotals} compact />
            </BigNumber>
          </Tile>
        </Bento>
      )}

      <FilterBar>
        <SearchFilter value={list.params.q} onChange={(v) => list.set({ q: v })} placeholder="Search deal or company" />
        <div className="ml-auto flex items-center gap-2">
          {view === 'table' && (
            <ExportButton disabled={!sortedDeals.length || !canSee} onClick={() => exportColumnsCsv('pipeline', columns, sortedDeals)} />
          )}
          <ViewToggle
            value={view}
            onChange={(v) => list.set({ view: v, page: list.params.page })}
            options={[
              { value: 'board', label: 'Board', icon: LayoutGrid },
              { value: 'table', label: 'Table', icon: Rows3 },
            ]}
          />
        </div>
      </FilterBar>

      {pipeline.isLoading ? (
        <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-6">
          {CRM_STAGE_ORDER.map((s) => (
            <Skeleton key={s} className="h-56 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : pipeline.error ? (
        <ErrorState error={pipeline.error} onRetry={() => pipeline.refetch()} className="rounded-[var(--radius)] border bg-card" />
      ) : all.length === 0 ? (
        <EmptyState
          illustration="money"
          className="rounded-[var(--radius)] border bg-card"
          title="No deals yet"
          description="Add leads as they come in and move them along as they progress."
          action={
            <Button size="sm" variant="brand" onClick={newDeal}>
              Add your first deal
            </Button>
          }
        />
      ) : view === 'table' ? (
        <DataTable
          columns={visibleColumns}
          rows={sortedDeals}
          rowKey={(o) => o._id}
          sort={list.sort}
          onSortChange={list.setSort}
          onRowClick={openDeal}
          rowClassName={(o) => (isOverdue(o) ? 'bg-destructive/[0.03]' : undefined)}
          empty={<EmptyState illustration="inbox" title="No deals match your search" />}
        />
      ) : (
        <div className="-mx-1 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-2 xl:grid-flow-row xl:grid-cols-6">
          {CRM_STAGE_ORDER.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const totals = totalsByCurrency(items, (o) => o.valuePaise, (o) => o.currency);
            const weighted = isOpen(stage) ? totalsByCurrency(items, weightedOf, (o) => o.currency) : undefined;
            const late = items.filter(isOverdue).length;
            const dropping = dropStage === stage && !!dragId;
            return (
              <section
                key={stage}
                aria-label={`${CRM_STAGE_LABEL[stage]} — ${items.length} ${plural(items.length, 'deal', 'deals')}`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropStage !== stage) setDropStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropStage((s) => (s === stage ? null : s));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  const deal = all.find((o) => o._id === id);
                  setDragId(null);
                  setDropStage(null);
                  if (deal) changeStage(deal, stage);
                }}
                className={cn(
                  'flex min-w-0 flex-col rounded-[var(--radius)] border bg-muted/30 transition-colors',
                  dropping && 'border-brand bg-brand-wash',
                )}
              >
                <header className="space-y-1 px-3 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                    <h2 className="text-sm font-semibold">{CRM_STAGE_LABEL[stage]}</h2>
                    <span className="rounded-full bg-card px-1.5 font-figures text-[11px] text-muted-foreground">{items.length}</span>
                    {late > 0 && (
                      <Badge variant="danger" className="ml-auto">
                        {late} late
                      </Badge>
                    )}
                  </div>
                  {items.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      <PriceTotals totals={totals} className="font-medium text-foreground" />
                      {weighted && (
                        <span className="block">
                          ≈ <PriceTotals totals={weighted} compact /> weighted
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Empty</p>
                  )}
                </header>
                <div className="flex-1 space-y-2 p-2 pt-0">
                  {items.length === 0 && (
                    <p className="rounded-md border border-dashed px-2 py-5 text-center text-xs text-muted-foreground">{dragId ? 'Drop here' : 'No deals'}</p>
                  )}
                  {items.map((o) => (
                    <DealCard
                      key={o._id}
                      deal={o}
                      company={companyOf(o)}
                      dragging={dragId === o._id}
                      onDragStart={() => setDragId(o._id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropStage(null);
                      }}
                      onOpen={() => openDeal(o)}
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

function CompanyLabel({ company, className }: { company: Company; className?: string }) {
  if (company.prospect) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-muted-foreground', className)}>
        <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-muted-foreground" />
        <span className="truncate">
          {company.label}
          {company.label !== 'No company' && ' · prospect'}
        </span>
      </span>
    );
  }
  return (
    <ClientChip
      clientId={company.clientId}
      name={company.missing || company.loading ? undefined : company.label}
      loading={company.loading}
      className={className}
    />
  );
}

function DealCard({
  deal: o,
  company,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onStage,
  onWonActions,
}: {
  deal: OpportunityRow;
  company: Company;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onStage: (s: CrmStage) => void;
  onWonActions: () => void;
}) {
  const overdue = isOverdue(o);
  const idx = CRM_STAGE_ORDER.indexOf(o.stage);
  const next = isOpen(o.stage) ? CRM_STAGE_ORDER[idx + 1] : undefined;
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', o._id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative rounded-lg border bg-card p-3 text-xs shadow-sm transition-[border-color,opacity] hover:border-foreground/25',
        overdue && 'border-destructive/40',
        dragging && 'opacity-50',
      )}
    >
      <GripVertical className="absolute right-1.5 top-2.5 h-3.5 w-3.5 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <button type="button" onClick={onOpen} className="block w-full pr-4 text-left">
        <p className="text-[13px] font-semibold leading-snug group-hover:underline">{o.title}</p>
        <CompanyLabel company={company} className="mt-1 max-w-full" />
      </button>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <Price paise={o.valuePaise} currency={o.currency} compact className="font-display text-base font-bold" />
        {isOpen(o.stage) && (
          <span className="font-figures text-muted-foreground" title={o.probability === undefined ? 'Stage default win chance' : 'Win chance'}>
            {probabilityOf(o)}%
          </span>
        )}
      </div>
      {o.expectedCloseDate && isOpen(o.stage) && (
        <p className={cn('mt-1.5 flex flex-wrap items-center gap-1', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          <CalendarClock className="h-3 w-3" />
          {overdue ? 'Was due ' : 'Close by '}
          {formatDate(o.expectedCloseDate)}
          {overdue && (
            <Badge variant="danger" className="ml-auto">
              Overdue
            </Badge>
          )}
        </p>
      )}
      {o.stage === CrmStage.LOST && o.lostReason && <p className="mt-1.5 line-clamp-2 text-muted-foreground">Lost: {o.lostReason}</p>}
      {o.stage === CrmStage.WON && o.closedAt && <p className="mt-1.5 text-muted-foreground">Won {formatDate(o.closedAt)}</p>}
      <div className="mt-2.5 flex items-center gap-1">
        <Select aria-label={`Stage of ${o.title}`} className="h-7 flex-1 px-2 text-xs" value={o.stage} onChange={(e) => onStage(e.target.value as CrmStage)}>
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
            className="rounded-md border p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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
            className="rounded-md border p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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
            <Trophy className="h-5 w-5 text-success" /> Deal won — what next?
          </DialogTitle>
          <DialogDescription>
            {deal.title} · <Price paise={deal.valuePaise} currency={deal.currency} />
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
