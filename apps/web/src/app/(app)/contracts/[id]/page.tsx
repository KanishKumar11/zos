// Contract — terms, billing history and one-click monthly invoices (OWNER).
'use client';

import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContractStatus, InvoiceStatus, Role } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { thisMonthLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Bento, BigNumber, FillJar, Price, PrivacyChip, Tile } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import {
  CONTRACT_STATUS_TONE,
  contractStatusLabel,
  daysToEnd,
  daysUntil,
  defaultGst,
  dueThisMonth,
  endsSoon,
  financialYearLabel,
  financialYearStart,
  monthLabel,
  nextBillingDate,
} from '@/features/contracts/contract-utils';
import { ContractFormDialog } from '@/features/contracts/contract-form-dialog';
import { useContract, useDeleteContract } from '@/features/contracts/contracts.hooks';
import { GenerateInvoiceDialog } from '@/features/contracts/generate-invoice-dialog';
import { ClientChip } from '@/features/contracts/price-totals';
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
            illustration="files"
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
  const month = thisMonthLocal();
  const d = daysToEnd(c);
  const next = nextBillingDate(c);
  const fyStart = financialYearStart();

  const history: HistoryRow[] = (invoices.data ?? [])
    .map((inv) => ({ ...inv, ...contractShare(inv, contractId) }))
    .sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? ''));
  const counted = history.filter((inv) => !NOT_BILLED.has(inv.status));
  const billed = counted.reduce((s, inv) => s + inv.billedPaise, 0);
  const paid = counted.reduce((s, inv) => s + inv.sharePaidPaise, 0);
  const outstanding = Math.max(0, billed - paid);
  const drafts = history.filter((inv) => inv.status === InvoiceStatus.DRAFT).length;
  const fyRows = counted.filter((inv) => (inv.issueDate ?? '').slice(0, 10) >= fyStart);
  const billedFy = fyRows.reduce((s, inv) => s + inv.billedPaise, 0);
  const paidFy = fyRows.reduce((s, inv) => s + inv.sharePaidPaise, 0);

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
        <Link href={`/invoices/${inv._id}`} className="font-figures text-[13px] hover:underline">
          {inv.number}
        </Link>
      ),
    },
    {
      id: 'month',
      header: 'For',
      cell: (inv) => (inv.issueDate ? monthLabel(inv.issueDate.slice(0, 7)) : <span className="text-muted-foreground">No date</span>),
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
        <Price paise={inv.billedPaise} currency={inv.currency || c.currency} className={NOT_BILLED.has(inv.status) ? 'text-muted-foreground' : undefined} />
      ),
      footer: <Price paise={billed} currency={c.currency} />,
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'right',
      hideBelow: 'sm',
      cell: (inv) => <Price paise={inv.sharePaidPaise} currency={inv.currency || c.currency} />,
      footer: <Price paise={paid} currency={c.currency} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        eyebrow={<ClientChip clientId={c.clientId} name={client?.name} loading={clients.isLoading} href={client ? `/clients/${client._id}` : undefined} />}
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
            <Button size="sm" variant="brand" onClick={() => setGenerateOpen(true)}>
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            {monthLabel(month)} hasn’t been invoiced yet.
          </span>
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            Bill {monthLabel(month)}
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <PrivacyChip>Only you see these figures</PrivacyChip>
      </div>

      <Bento>
        <Tile span={4} tone="ink" title="Monthly amount">
          <BigNumber caption={`+ ${defaultGst(c)}% GST by default · ${c.currency}`} className="[&>div]:text-brand">
            <Price paise={c.monthlyAmountPaise} currency={c.currency} />
          </BigNumber>
        </Tile>
        <Tile span={4} title={`Billed this ${financialYearLabel()}`}>
          {invoices.isLoading ? (
            <Skeleton className="h-12 w-3/4" />
          ) : invoices.error ? (
            <p className="text-sm text-muted-foreground">Couldn’t load invoices.</p>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <BigNumber
                caption={
                  <>
                    <Price paise={paidFy} currency={c.currency} /> collected
                    {billedFy - paidFy > 0 && (
                      <>
                        {' '}
                        · <Price paise={billedFy - paidFy} currency={c.currency} /> to come
                      </>
                    )}
                  </>
                }
              >
                <Price paise={billedFy} currency={c.currency} />
              </BigNumber>
              {billedFy > 0 && <FillJar value={paidFy} max={billedFy} label={`${Math.round((paidFy / billedFy) * 100)}% of this year’s billing collected`} />}
            </div>
          )}
        </Tile>
        <Tile span={4} title="Next billing date">
          {next ? (
            <BigNumber caption={`Day ${c.billingDay} of every month · ${daysUntil(next) === 0 ? 'today' : daysUntil(next) === 1 ? 'tomorrow' : `in ${daysUntil(next)} days`}`}>
              {formatDate(next)}
            </BigNumber>
          ) : c.status !== ContractStatus.ACTIVE ? (
            <BigNumber caption={`${contractStatusLabel(c.status)} — nothing to bill`}>—</BigNumber>
          ) : !c.billingDay ? (
            <div>
              <BigNumber>—</BigNumber>
              <p className="mt-1.5 text-xs text-warning">
                No billing day, so no dashboard reminder.{' '}
                <button type="button" className="font-medium underline" onClick={() => setEditOpen(true)}>
                  Set a day
                </button>
              </p>
            </div>
          ) : (
            <BigNumber caption="The contract has ended">—</BigNumber>
          )}
        </Tile>

        <Tile span={8} title="Terms">
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Client</dt>
              <dd className="mt-0.5">
                <ClientChip clientId={c.clientId} name={client?.name} loading={clients.isLoading} href={client ? `/clients/${client._id}` : undefined} className="font-medium" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Term</dt>
              <dd className="mt-0.5">
                {c.startDate ? formatDate(c.startDate) : 'No start date'} – {c.endDate ? formatDate(c.endDate) : 'ongoing'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">GST on invoices</dt>
              <dd className="mt-0.5">
                {defaultGst(c)}%{typeof c.gstPercent !== 'number' && <span className="text-muted-foreground"> (default)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payment terms</dt>
              <dd className="mt-0.5">{client ? (client.paymentTermsDays === 0 ? 'Due on receipt' : `Net ${client.paymentTermsDays ?? 15}`) : '—'}</dd>
            </div>
            {c.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-line">{c.notes}</dd>
              </div>
            )}
          </dl>
        </Tile>
        <Tile span={4} title="All time">
          {invoices.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Billed</dt>
                <dd>
                  <Price paise={billed} currency={c.currency} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Collected</dt>
                <dd className={paid ? 'text-success' : undefined}>
                  <Price paise={paid} currency={c.currency} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className={outstanding ? 'text-warning' : undefined}>
                  <Price paise={outstanding} currency={c.currency} />
                </dd>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                {drafts ? `${drafts} draft${drafts === 1 ? '' : 's'} not counted` : `${counted.length} invoice${counted.length === 1 ? '' : 's'} issued`}
              </p>
            </dl>
          )}
        </Tile>
      </Bento>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Invoice history</h2>
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
              illustration="files"
              title="No invoices yet"
              description="Generate this month’s invoice in one click — it starts as a draft you can review."
              action={
                <Button size="sm" variant="brand" onClick={() => setGenerateOpen(true)}>
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
