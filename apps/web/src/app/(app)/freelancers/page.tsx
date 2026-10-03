// Freelancers — directory of the people you hire per project, with what each has been paid and is
// still owed (OWNER). Cards by default; the table is one toggle away.
'use client';

import { AlertTriangle, LayoutGrid, Plus, Rows3 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { csvMoney } from '@/lib/csv';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useQuickActions } from '@/store/quick-actions.store';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { ExportButton, FilterBar, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { useNewParam } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Avatar, Hero, HeroFigure, HeroMark, Price, PrivacyChip, useCanSeePrices } from '@/components/viz';
import { FreelancerCard, FreelancerCardSkeleton } from '@/features/freelancers/freelancer-card';
import { FreelancerFormDialog } from '@/features/freelancers/freelancer-form-dialog';
import { useFreelancers, type FreelancerRow } from '@/features/freelancers/freelancers.hooks';

type View = 'cards' | 'table';

export default function FreelancersPage() {
  const router = useRouter();
  const list = useListState('freelancers', { q: '', owed: '', sort: 'name:asc', view: 'cards' });
  const view: View = list.params.view === 'table' ? 'table' : 'cards';
  const freelancers = useFreelancers(list.params.q || undefined);
  // Unsearched list for the hero sentence, so it describes everyone (shares the cache with the pickers).
  const everyone = useFreelancers();
  const canSee = useCanSeePrices();
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const [createOpen, setCreateOpen] = useState(false);
  useNewParam(() => setCreateOpen(true));

  const columns: Column<FreelancerRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar id={r._id} name={r.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/freelancers/${r._id}`} className="font-medium hover:underline">
              {r.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{[r.skill, r.email].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ),
      csv: (r) => r.name,
    },
    { id: 'email', header: 'Email', cell: () => null, className: 'hidden', csv: (r) => r.email ?? '' },
    { id: 'projects', header: 'Deals', align: 'right', sortable: true, sortValue: (r) => r.projectCount, hideBelow: 'sm', cell: (r) => <span className="font-figures">{r.projectCount}</span>, csv: (r) => r.projectCount },
    { id: 'agreed', header: 'Agreed', align: 'right', sortable: true, sortValue: (r) => r.agreedPaise, hideBelow: 'md', cell: (r) => <Price paise={r.agreedPaise} />, csv: (r) => csvMoney(r.agreedPaise) },
    { id: 'paid', header: 'Paid', align: 'right', sortable: true, sortValue: (r) => r.paidPaise, cell: (r) => <Price paise={r.paidPaise} />, csv: (r) => csvMoney(r.paidPaise) },
    {
      id: 'pending',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pendingPaise,
      cell: (r) => <Price paise={r.pendingPaise} className={r.pendingPaise > 0 ? 'font-medium text-warning' : ''} />,
      csv: (r) => csvMoney(r.pendingPaise),
    },
    {
      id: 'last',
      header: 'Last paid',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (r) => r.lastPaidAt ?? '',
      cell: (r) => (r.lastPaidAt ? formatDate(r.lastPaidAt) : <span className="text-muted-foreground">Never</span>),
      csv: (r) => (r.lastPaidAt ? String(r.lastPaidAt).slice(0, 10) : ''),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => openLogPayment({ payeeType: 'FREELANCER', freelancerId: r._id })}>
          Pay
        </Button>
      ),
    },
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');

  const rows = (freelancers.data ?? []).filter((f) => (list.params.owed === 'owed' ? f.pendingPaise > 0 : true));
  const sorted = sortRows(rows, columns, list.sort);
  const unlinked = (everyone.data ?? []).filter((f) => f.legacyEngagements.length > 0);
  const searching = !!list.params.q || list.params.owed === 'owed';

  const emptyState = searching ? (
    <EmptyState
      illustration="people"
      title="No freelancers match"
      description="Try a different name, email or skill."
      action={
        <Button variant="outline" size="sm" onClick={() => list.set({ q: '', owed: '' })}>
          Clear search
        </Button>
      }
    />
  ) : (
    <EmptyState
      illustration="people"
      title="No freelancers yet"
      description="Add the people you hire per project, then add them to projects with their agreed fee."
      action={
        <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add freelancer
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <FreelancersHero rows={everyone.data} loading={everyone.isLoading} error={everyone.isError} onAdd={() => setCreateOpen(true)} />

      {unlinked.length > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">
              {unlinked.length} freelancer{unlinked.length === 1 ? ' has' : 's have'} older agreements not linked to a project
            </p>
            <p className="text-muted-foreground">
              Open{' '}
              {unlinked.slice(0, 3).map((f, i) => (
                <span key={f._id}>
                  {i > 0 && ', '}
                  <Link href={`/freelancers/${f._id}`} className="text-brand-ink hover:underline">
                    {f.name}
                  </Link>
                </span>
              ))}
              {unlinked.length > 3 && ` and ${unlinked.length - 3} more`} and pick the right project so project costs are complete.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar className="flex-1">
          <SearchFilter value={list.params.q} onChange={(q) => list.set({ q })} placeholder="Search name, email, skill" />
          <SelectFilter value={list.params.owed} onChange={(owed) => list.set({ owed })} allLabel="Everyone" options={[{ value: 'owed', label: 'Still owed money' }]} />
        </FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          {canSee && <ExportButton disabled={!rows.length} onClick={() => exportColumnsCsv('freelancers', columns, sorted)} />}
          <ViewToggle<View>
            value={view}
            onChange={(v) => list.set({ view: v })}
            options={[
              { value: 'cards', label: 'Cards', icon: LayoutGrid },
              { value: 'table', label: 'Table', icon: Rows3 },
            ]}
          />
        </div>
      </div>

      {view === 'cards' ? (
        freelancers.isLoading ? (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <FreelancerCardSkeleton key={i} />
            ))}
          </div>
        ) : freelancers.isError ? (
          <div className="rounded-[var(--radius)] border bg-card">
            <ErrorState title="Couldn't load freelancers" error={freelancers.error} onRetry={() => freelancers.refetch()} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-[var(--radius)] border bg-card">{emptyState}</div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((f) => (
              <FreelancerCard key={f._id} f={f} />
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={visible}
          rows={sorted}
          rowKey={(r) => r._id}
          loading={freelancers.isLoading}
          error={freelancers.error}
          onRetry={() => freelancers.refetch()}
          sort={list.sort}
          onSortChange={list.setSort}
          rowHref={(r) => `/freelancers/${r._id}`}
          empty={emptyState}
        />
      )}

      <FreelancerFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={(id) => router.push(`/freelancers/${id}`)} />
    </div>
  );
}

/** "You've paid 6 freelancers ₹3.4L so far — ₹42k is still owed to 2 of them." */
function FreelancersHero({ rows, loading, error, onAdd }: { rows: FreelancerRow[] | undefined; loading: boolean; error: boolean; onAdd: () => void }) {
  const all = rows ?? [];
  const paid = all.reduce((s, f) => s + f.paidPaise, 0);
  const owed = all.filter((f) => f.pendingPaise > 0);
  const owedPaise = owed.reduce((s, f) => s + f.pendingPaise, 0);
  const paidCount = all.filter((f) => f.paidPaise > 0).length;
  const deals = all.reduce((s, f) => s + f.projectCount, 0);

  let sentence: ReactNode;
  if (error) sentence = 'The people you hire per project, and what each is owed.';
  else if (all.length === 0) sentence = 'No freelancers yet. Add the people you hire per project.';
  else if (paid === 0 && owedPaise === 0) sentence = `${all.length} freelancer${all.length === 1 ? '' : 's'} on file, and nothing paid yet.`;
  else
    sentence = (
      <>
        You&apos;ve paid {paidCount} freelancer{paidCount === 1 ? '' : 's'}{' '}
        <HeroFigure>
          <Price paise={paid} compact className="font-display" />
        </HeroFigure>{' '}
        so far
        {owedPaise > 0 ? (
          <>
            {' '}
            —{' '}
            <HeroMark>
              <Price paise={owedPaise} compact className="font-display" />
            </HeroMark>{' '}
            is still owed{owed.length === 1 ? ` to ${owed[0]!.name}` : ` to ${owed.length} of them`}.
          </>
        ) : (
          <>. Nobody is waiting on a payment.</>
        )}
      </>
    );

  return (
    <Hero
      pageTitle="Freelancers"
      eyebrow="People you hire per project"
      loading={loading}
      lede={
        error
          ? "We couldn't load the totals just now."
          : all.length > 0
          ? `${all.length} freelancer${all.length === 1 ? '' : 's'} across ${deals} project deal${deals === 1 ? '' : 's'}. Their deal lives on the project; payments in Payments out.`
          : 'Their deal lives on the project, and every payment goes in Payments out.'
      }
      aside={
        <>
          <PrivacyChip>Only you see these figures</PrivacyChip>
          <Button size="sm" variant="brand" onClick={onAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add freelancer
          </Button>
        </>
      }
    >
      {sentence}
    </Hero>
  );
}
