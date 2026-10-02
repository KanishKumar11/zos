// Contract — terms, billing history and one-click monthly invoices (OWNER).
'use client';

import { AlertTriangle, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContractStatus, InvoiceStatus, Role } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { thisMonthLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { useClients } from '@/features/clients/clients.hooks';
import {
  CONTRACT_STATUS_TONE,
  contractStatusLabel,
  daysToEnd,
  defaultGst,
  dueThisMonth,
  endsSoon,
  monthLabel,
} from '@/features/contracts/contract-utils';
import { ContractFormDialog } from '@/features/contracts/contract-form-dialog';
import { useContract, useDeleteContract } from '@/features/contracts/contracts.hooks';
import { GenerateInvoiceDialog } from '@/features/contracts/generate-invoice-dialog';
import { useInvoices, type InvoiceRow } from '@/features/invoices/invoices.hooks';

export default function ContractDetailPage() {
  const params = useParams();
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner contractId={params.id as string} />
    </RoleGate>
  );
}

/** Drafts aren't issued yet and written-off invoices won't be paid — neither counts as billed. */
const NOT_BILLED = new Set<string>([InvoiceStatus.DRAFT, InvoiceStatus.WRITTEN_OFF]);

/**
 * This contract's slice of an invoice. Invoices linked only at the header bill the
 * contract in full; a combined invoice bills it through its own lines, and payments
 * are split in proportion to those lines.
 */
function contractShare(inv: InvoiceRow, contractId: string): { billedPaise: number; sharePaidPaise: number } {
  const lines = inv.lineItems.filter((li) => li.contractId === contractId);
  if (lines.length === 0) return { billedPaise: inv.totalPaise, sharePaidPaise: inv.paidPaise };
  const lineTotal = lines.reduce((s, li) => s + Math.round(li.qty * li.unitPaise), 0);
  const ratio = inv.subTotalPaise > 0 ? lineTotal / inv.subTotalPaise : 0;
  return {
    billedPaise: Math.round(inv.totalPaise * ratio),
    sharePaidPaise: Math.round(inv.paidPaise * ratio),
  };
}

type HistoryRow = InvoiceRow & { billedPaise: number; sharePaidPaise: number };

function Inner({ contractId }: { contractId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const contract = useContract(contractId);
  const clients = useClients();
  const invoices = useInvoices({ contractId });
  const del = useDeleteContract();
  const [editOpen, setEditOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  if (contract.isLoading) return <PageSkeleton />;
  if (contract.error || !contract.data) {
    const notFound = contract.error instanceof ApiRequestError && contract.error.status === 404;
    return (
      <div className="space-y-5">
        <PageHeader title={notFound ? 'Contract not found' : 'Contract'} crumbs={[{ label: 'Contracts', href: '/contracts' }]} />
        {notFound ? (
          <EmptyState
            icon={FileText}
            title="This contract doesn’t exist or was deleted"
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/contracts">Back to contracts</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={contract.error} onRetry={() => contract.refetch()} />
        )}
      </div>
    );
  }

  const c = contract.data;
  const client = clients.data?.find((cl) => cl._id === c.clientId);
  const clientLabel = client?.name ?? (clients.isLoading ? '…' : 'Deleted client');
  const month = thisMonthLocal();
  const d = daysToEnd(c);

  const history: HistoryRow[] = (invoices.data ?? [])
    .map((inv) => ({ ...inv, ...contractShare(inv, contractId) }))
    .sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? ''));
  const counted = history.filter((inv) => !NOT_BILLED.has(inv.status));
  const billed = counted.reduce((s, inv) => s + inv.billedPaise, 0);
  const paid = counted.reduce((s, inv) => s + inv.sharePaidPaise, 0);
  const outstanding = Math.max(0, billed - paid);
  const drafts = history.filter((inv) => inv.status === InvoiceStatus.DRAFT).length;

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      description: 'Invoices already generated from it stay as they are, but you won’t be able to bill this contract again.',
      confirmText: 'Delete contract',
      destructive: true,
    });
    if (ok) del.mutate(contractId, { onSuccess: () => router.push('/contracts') });
  };

  const columns: Column<HistoryRow>[] = [
    {
      id: 'number',
      header: 'Invoice',
      cell: (inv) => (
        <Link href={`/invoices/${inv._id}`} className="font-mono text-[13px] hover:underline">
          {inv.number}
        </Link>
      ),
    },
    {
      id: 'month',
      header: 'For',
      cell: (inv) => (inv.issueDate ? monthLabel(inv.issueDate.slice(0, 7)) : '—'),
    },
    { id: 'status', header: 'Status', cell: (inv) => <StatusBadge status={inv.status} /> },
    {
      id: 'due',
      header: 'Due',
      hideBelow: 'md',
      cell: (inv) => (inv.dueDate ? formatDate(inv.dueDate) : <span className="text-muted-foreground">—</span>),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (inv) => (
        <span className={NOT_BILLED.has(inv.status) ? 'text-muted-foreground' : undefined}>{formatPaise(inv.billedPaise, inv.currency || c.currency)}</span>
      ),
      footer: formatPaise(billed, c.currency),
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'right',
      cell: (inv) => formatPaise(inv.sharePaidPaise, inv.currency || c.currency),
      footer: formatPaise(paid, c.currency),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        crumbs={[
          { label: 'Contracts', href: '/contracts' },
          ...(client ? [{ label: client.name, href: `/contracts?clientId=${client._id}` }] : []),
        ]}
        description={c.description || undefined}
        meta={
          <>
            <Badge variant={CONTRACT_STATUS_TONE[c.status]}>{contractStatusLabel(c.status)}</Badge>
            {endsSoon(c) && <Badge variant="warning">{d === 0 ? 'Ends today' : `Ends in ${d} day${d === 1 ? '' : 's'}`}</Badge>}
            {c.status === ContractStatus.ACTIVE && d !== undefined && d < 0 && <Badge variant="danger">Past end date</Badge>}
          </>
        }
        action={
          <>
            <Button size="sm" onClick={() => setGenerateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate invoice
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => void remove()} disabled={del.isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </>
        }
      />

      {dueThisMonth(c, month) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-600/30 bg-amber-600/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {monthLabel(month)} hasn’t been invoiced yet.
          </span>
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            Bill {monthLabel(month)}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly amount" value={formatPaise(c.monthlyAmountPaise, c.currency)} hint={`+ ${defaultGst(c)}% GST by default`} />
        <StatCard
          label="Billed"
          loading={invoices.isLoading}
          value={formatPaise(billed, c.currency)}
          hint={drafts ? `${drafts} draft${drafts === 1 ? '' : 's'} not counted` : `${counted.length} invoice${counted.length === 1 ? '' : 's'} issued`}
        />
        <StatCard label="Collected" loading={invoices.isLoading} tone={paid ? 'success' : 'default'} value={formatPaise(paid, c.currency)} />
        <StatCard label="Outstanding" loading={invoices.isLoading} tone={outstanding ? 'warning' : 'default'} value={formatPaise(outstanding, c.currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Client</dt>
              <dd className="mt-0.5">
                {client ? (
                  <Link href={`/clients/${client._id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{clientLabel}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Term</dt>
              <dd className="mt-0.5">
                {c.startDate ? formatDate(c.startDate) : 'No start date'} – {c.endDate ? formatDate(c.endDate) : 'ongoing'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Billing reminder</dt>
              <dd className="mt-0.5">
                {c.billingDay ? (
                  `Day ${c.billingDay} of every month`
                ) : (
                  <span className="text-amber-600">
                    Not set — no dashboard reminder.{' '}
                    <button type="button" className="underline" onClick={() => setEditOpen(true)}>
                      Set a day
                    </button>
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">GST on invoices</dt>
              <dd className="mt-0.5">
                {defaultGst(c)}%{typeof c.gstPercent !== 'number' && <span className="text-muted-foreground"> (default)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Currency</dt>
              <dd className="mt-0.5">{c.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payment terms</dt>
              <dd className="mt-0.5">
                {client ? (client.paymentTermsDays === 0 ? 'Due on receipt' : `Net ${client.paymentTermsDays ?? 15}`) : '—'}
              </dd>
            </div>
            {c.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-line">{c.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Billing history</h2>
          {history.length > 0 && <p className="text-xs text-muted-foreground">Drafts and written-off invoices aren’t counted in the totals.</p>}
        </div>
        <DataTable
          columns={columns}
          rows={history}
          rowKey={(inv) => inv._id}
          loading={invoices.isLoading}
          error={invoices.error}
          onRetry={() => invoices.refetch()}
          rowHref={(inv) => `/invoices/${inv._id}`}
          showFooter={counted.length > 0}
          empty={
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Generate this month’s invoice in one click — it starts as a draft you can review."
              action={
                <Button size="sm" onClick={() => setGenerateOpen(true)}>
                  Generate invoice
                </Button>
              }
            />
          }
        />
      </div>

      <ContractFormDialog open={editOpen} onOpenChange={setEditOpen} contract={c} />
      <GenerateInvoiceDialog
        contract={c}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(inv) => router.push(`/invoices/${inv._id}`)}
      />
    </div>
  );
}
