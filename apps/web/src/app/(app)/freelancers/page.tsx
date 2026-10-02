// Freelancers — directory with what each is owed across projects (OWNER).
'use client';

import { AlertTriangle, Download, Plus, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { csvMoney } from '@/lib/csv';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useQuickActions } from '@/store/quick-actions.store';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { FreelancerFormDialog } from '@/features/freelancers/freelancer-form-dialog';
import { useFreelancers, type FreelancerRow } from '@/features/freelancers/freelancers.hooks';

export default function FreelancersPage() {
  const router = useRouter();
  const list = useListState('freelancers', { q: '', owed: '', sort: 'name:asc' });
  const freelancers = useFreelancers(list.params.q || undefined);
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
        <div>
          <Link href={`/freelancers/${r._id}`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <p className="text-xs text-muted-foreground">{[r.skill, r.email].filter(Boolean).join(' · ')}</p>
        </div>
      ),
      csv: (r) => r.name,
    },
    { id: 'email', header: 'Email', cell: () => null, className: 'hidden', csv: (r) => r.email ?? '' },
    { id: 'projects', header: 'Projects', align: 'right', sortable: true, sortValue: (r) => r.projectCount, hideBelow: 'sm', cell: (r) => r.projectCount, csv: (r) => r.projectCount },
    { id: 'agreed', header: 'Agreed', align: 'right', sortable: true, sortValue: (r) => r.agreedPaise, hideBelow: 'md', cell: (r) => formatPaise(r.agreedPaise), csv: (r) => csvMoney(r.agreedPaise) },
    { id: 'paid', header: 'Paid', align: 'right', sortable: true, sortValue: (r) => r.paidPaise, cell: (r) => formatPaise(r.paidPaise), csv: (r) => csvMoney(r.paidPaise) },
    {
      id: 'pending',
      header: 'Pending',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pendingPaise,
      cell: (r) => <span className={r.pendingPaise > 0 ? 'font-medium text-amber-700 dark:text-amber-500' : ''}>{formatPaise(r.pendingPaise)}</span>,
      csv: (r) => csvMoney(r.pendingPaise),
    },
    {
      id: 'last',
      header: 'Last paid',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (r) => r.lastPaidAt ?? '',
      cell: (r) => (r.lastPaidAt ? formatDate(r.lastPaidAt) : <span className="text-muted-foreground">Never</span>),
      csv: (r) => r.lastPaidAt?.slice(0, 10) ?? '',
    },
    {
      id: 'actions',
      header: '',
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
  const totalPending = (freelancers.data ?? []).reduce((s, f) => s + f.pendingPaise, 0);
  const totalPaid = (freelancers.data ?? []).reduce((s, f) => s + f.paidPaise, 0);
  const unlinked = (freelancers.data ?? []).filter((f) => f.legacyEngagements.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Freelancers"
        description="People you hire per project. Their deal lives on the project; payments in Payments out."
        action={
          <>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportColumnsCsv('freelancers', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add freelancer
            </Button>
          </>
        }
      />

      {unlinked.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">{unlinked.length} freelancer{unlinked.length === 1 ? ' has' : 's have'} older agreements not linked to a project</p>
            <p className="text-muted-foreground">
              Open{' '}
              {unlinked.slice(0, 3).map((f, i) => (
                <span key={f._id}>
                  {i > 0 && ', '}
                  <Link href={`/freelancers/${f._id}`} className="text-primary hover:underline">
                    {f.name}
                  </Link>
                </span>
              ))}
              {unlinked.length > 3 && ` and ${unlinked.length - 3} more`} and pick the right project so project costs are complete.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Freelancers" loading={freelancers.isLoading} value={String(freelancers.data?.length ?? 0)} />
        <StatCard label="Paid to date" loading={freelancers.isLoading} value={formatPaise(totalPaid)} href="/payments?payeeType=FREELANCER" />
        <StatCard label="Still owed" tone={totalPending > 0 ? 'warning' : 'default'} loading={freelancers.isLoading} value={formatPaise(totalPending)} />
      </div>

      <FilterBar>
        <SearchFilter value={list.params.q} onChange={(q) => list.set({ q })} placeholder="Search name, email, skill" />
        <SelectFilter value={list.params.owed} onChange={(owed) => list.set({ owed })} allLabel="Everyone" options={[{ value: 'owed', label: 'Still owed money' }]} />
      </FilterBar>

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
        empty={
          <EmptyState
            icon={UserCheck}
            title={list.params.q ? 'No freelancers match' : 'No freelancers yet'}
            description="Add the people you hire per project, then add them to projects with their agreed fee."
            action={<Button size="sm" onClick={() => setCreateOpen(true)}>Add freelancer</Button>}
          />
        }
      />

      <FreelancerFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={(id) => router.push(`/freelancers/${id}`)} />
    </div>
  );
}
