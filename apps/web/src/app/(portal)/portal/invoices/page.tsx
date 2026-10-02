'use client';

import { Receipt } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { formatDate, formatPaise } from '@/lib/formatters';

import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortalInvoices, type PortalInvoice } from '@/features/portal/portal.hooks';

export default function PortalInvoices() {
  const invoices = usePortalInvoices();
  const router = useRouter();
  const pathname = usePathname();
  const show = useSearchParams().get('show') ?? 'all';
  const all = invoices.data ?? [];
  const open = all.filter((i) => i.balancePaise > 0 && i.status !== 'WRITTEN_OFF');
  const rows = show === 'open' ? open : all;
  const due = open.reduce((s, i) => s + i.balancePaise, 0);
  const paid = all.reduce((s, i) => s + i.paidPaise, 0);

  const columns: Column<PortalInvoice>[] = [
    { id: 'number', header: 'Invoice', cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'projects', header: 'For', hideBelow: 'md', cell: (r) => <span className="text-muted-foreground">{r.projects.join(', ') || '—'}</span> },
    { id: 'issued', header: 'Issued', hideBelow: 'sm', cell: (r) => (r.issueDate ? formatDate(r.issueDate) : '—') },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => (r.dueDate ? <span className={r.status === 'OVERDUE' ? 'font-medium text-destructive' : ''}>{formatDate(r.dueDate)}</span> : '—'),
    },
    { id: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'total', header: 'Total', align: 'right', cell: (r) => formatPaise(r.totalPaise, r.currency) },
    {
      id: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (r) => <span className={r.balancePaise > 0 ? 'font-medium' : 'text-muted-foreground'}>{formatPaise(r.balancePaise, r.currency)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Your invoices, what's been paid and what's due." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Amount due" tone={due > 0 ? 'warning' : 'default'} loading={invoices.isLoading} value={formatPaise(due)} />
        <StatCard label="Open invoices" loading={invoices.isLoading} value={String(open.length)} />
        <StatCard label="Paid to date" tone="success" loading={invoices.isLoading} value={formatPaise(paid)} />
      </div>
      <Tabs value={show} onValueChange={(v) => router.replace(`${pathname}${v === 'all' ? '' : `?show=${v}`}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r._id}
        loading={invoices.isLoading}
        error={invoices.error}
        onRetry={() => invoices.refetch()}
        rowHref={(r) => `/portal/invoices/${r._id}`}
        empty={<EmptyState icon={Receipt} title={show === 'open' ? 'Nothing due — thank you!' : 'No invoices yet'} />}
      />
    </div>
  );
}
