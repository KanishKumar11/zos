// Contract — terms, billing history, contractors & monthly payouts, and one-click monthly invoices (OWNER).
'use client';

import { AlertTriangle, Pencil, Plus, Send, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  ContractStatus,
  InvoiceStatus,
  PAYOUT_METHOD_LABEL,
  PayeeType,
  PayoutCategory,
  Role,
} from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { thisMonthLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Avatar, Bento, BigNumber, FillJar, Price, PrivacyChip, Tile } from '@/components/viz';
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
import {
  useContractPayoutBalances,
  usePayouts,
  type BalanceRow,
  type PayoutRow,
} from '@/features/payouts/payouts.hooks';

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
  const contractBalances = useContractPayoutBalances(contractId);
  const contractPayouts = usePayouts({ contractId, pageSize: 100 });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);

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

  const balancesMap = useMemo(() => {
    const map = new Map<string, BalanceRow>();
    for (const b of contractBalances.data ?? []) {
      map.set(`${b.payeeType}:${b.payeeId}`, b);
    }
    return map;
  }, [contractBalances.data]);

  const members = c.members ?? [];
  const freelancers = c.freelancers ?? [];
  const totalContractors = members.length + freelancers.length;

  const totalMonthlyContractorPay =
    c.totalMonthlyPayPaise ??
    (members.reduce((s, m) => s + m.monthlyAmountPaise, 0) +
      freelancers.reduce((s, f) => s + f.monthlyAmountPaise, 0));
  const netMarginPaise = c.monthlyAmountPaise - totalMonthlyContractorPay;
  const marginPercent =
    c.monthlyAmountPaise > 0 ? Math.round((netMarginPaise / c.monthlyAmountPaise) * 100) : 0;
  const totalContractPaidPaise = (contractBalances.data ?? []).reduce((s, b) => s + b.paidPaise, 0);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      description: 'Invoices already generated from it stay as they are, but you won’t be able to bill this contract again.',
      confirmText: 'Delete contract',
      destructive: true,
    });
    if (ok) del.mutate(contractId, { onSuccess: () => router.push('/contracts') });
  };

  const invoiceColumns: Column<HistoryRow>[] = [
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

  const payoutColumns: Column<PayoutRow>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (p) => <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>,
    },
    {
      id: 'payee',
      header: 'Payee',
      cell: (p) => {
        const href = p.payeeType === PayeeType.MEMBER ? `/team/${p.userId}` : `/freelancers/${p.freelancerId}`;
        return (
          <div className="flex items-center gap-2">
            <Avatar id={p.userId ?? p.freelancerId} name={p.payeeName} size="xs" />
            <Link href={href} className="font-semibold text-xs hover:underline">
              {p.payeeName}
            </Link>
            <Badge variant={p.payeeType === PayeeType.MEMBER ? 'outline' : 'info'} className="text-[10px] px-1.5 py-0 font-normal">
              {p.payeeType === PayeeType.MEMBER ? 'Team' : 'Freelancer'}
            </Badge>
          </div>
        );
      },
    },
    {
      id: 'method',
      header: 'Method',
      hideBelow: 'md',
      cell: (p) => (
        <span className="text-xs text-muted-foreground">
          {PAYOUT_METHOD_LABEL[p.method]}
          {p.reference && <span className="block text-[11px]">{p.reference}</span>}
        </span>
      ),
    },
    {
      id: 'note',
      header: 'Note',
      hideBelow: 'lg',
      cell: (p) => <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground">{p.note || '—'}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (p) => <Price paise={p.amountPaise} currency={p.currency} className="font-semibold text-sm" />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => openLogPayment({}, p._id)}
          aria-label={`Edit payment to ${p.payeeName}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
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

        {/* Contractors & Monthly Payouts Tile */}
        <Tile
          span={12}
          title="Contractors & Monthly Pay"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Users className="mr-1.5 h-3.5 w-3.5" /> Manage contractors
              </Button>
              {totalContractors > 0 && (
                <Button size="sm" onClick={() => openLogPayment({ contractId: c._id, category: PayoutCategory.CONTRACT_FEE })}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
                </Button>
              )}
            </div>
          }
        >
          {totalContractors > 0 ? (
            <div className="space-y-4">
              {/* Margin & Payout Metrics Bar */}
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border bg-muted/20 p-3.5">
                <div>
                  <span className="block text-xs text-muted-foreground">Monthly Retainer</span>
                  <Price paise={c.monthlyAmountPaise} currency={c.currency} className="font-figures text-lg font-bold" />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Contractor Cost</span>
                  <Price paise={totalMonthlyContractorPay} currency={c.currency} className="font-figures text-lg font-bold text-warning" />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Net Monthly Margin</span>
                  <div className="flex items-baseline gap-1.5">
                    <Price
                      paise={netMarginPaise}
                      currency={c.currency}
                      className={cn('font-figures text-lg font-bold', netMarginPaise >= 0 ? 'text-success' : 'text-destructive')}
                    />
                    <span className={cn('text-xs font-semibold', netMarginPaise >= 0 ? 'text-success' : 'text-destructive')}>
                      ({marginPercent}%)
                    </span>
                  </div>
                </div>
                <div className="border-l pl-4">
                  <span className="block text-xs text-muted-foreground">Total Paid to Date</span>
                  <Price paise={totalContractPaidPaise} currency={c.currency} className="font-figures text-lg font-bold" />
                </div>
              </div>

              {/* Contractors list */}
              <div className="divide-y rounded-lg border">
                {members.map((m) => {
                  const b = balancesMap.get(`${PayeeType.MEMBER}:${m.userId}`);
                  const paidAmount = b?.paidPaise ?? 0;
                  const pending = Math.max(0, m.monthlyAmountPaise - paidAmount);
                  return (
                    <div key={m.userId} className="flex flex-wrap items-center justify-between gap-4 p-3.5 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <Avatar id={m.userId} name={m.name ?? 'Team Member'} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/team/${m.userId}`} className="font-semibold text-sm hover:underline">
                              {m.name ?? 'Team Member'}
                            </Link>
                            <Badge variant="outline" className="text-[10px] font-normal">Team</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{m.role || m.email || 'Contractor'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6">
                        <div className="text-right">
                          <span className="block text-[11px] text-muted-foreground">Monthly Pay</span>
                          <Price paise={m.monthlyAmountPaise} currency={c.currency} className="font-semibold text-sm" />
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] text-muted-foreground">Paid on Contract</span>
                          <Price paise={paidAmount} currency={c.currency} className="text-sm font-medium text-success" />
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="block text-[11px] text-muted-foreground">This Month</span>
                          {pending > 0 ? (
                            <span className="text-xs font-semibold text-warning"><Price paise={pending} currency={c.currency} /> pending</span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">Settled</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() =>
                            openLogPayment({
                              payeeType: PayeeType.MEMBER,
                              userId: m.userId,
                              contractId: c._id,
                              amountPaise: pending > 0 ? pending : m.monthlyAmountPaise,
                              category: PayoutCategory.CONTRACT_FEE,
                            })
                          }
                        >
                          <Send className="mr-1 h-3 w-3" /> Pay
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {freelancers.map((f) => {
                  const b = balancesMap.get(`${PayeeType.FREELANCER}:${f.freelancerId}`);
                  const paidAmount = b?.paidPaise ?? 0;
                  const pending = Math.max(0, f.monthlyAmountPaise - paidAmount);
                  return (
                    <div key={f.freelancerId} className="flex flex-wrap items-center justify-between gap-4 p-3.5 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <Avatar id={f.freelancerId} name={f.name ?? 'Freelancer'} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/freelancers/${f.freelancerId}`} className="font-semibold text-sm hover:underline">
                              {f.name ?? 'Freelancer'}
                            </Link>
                            <Badge variant="info" className="text-[10px] font-normal">Freelancer</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{f.scope || f.skill || f.email || 'Contractor'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6">
                        <div className="text-right">
                          <span className="block text-[11px] text-muted-foreground">Monthly Pay</span>
                          <Price paise={f.monthlyAmountPaise} currency={c.currency} className="font-semibold text-sm" />
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] text-muted-foreground">Paid on Contract</span>
                          <Price paise={paidAmount} currency={c.currency} className="text-sm font-medium text-success" />
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="block text-[11px] text-muted-foreground">This Month</span>
                          {pending > 0 ? (
                            <span className="text-xs font-semibold text-warning"><Price paise={pending} currency={c.currency} /> pending</span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">Settled</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() =>
                            openLogPayment({
                              payeeType: PayeeType.FREELANCER,
                              freelancerId: f.freelancerId,
                              contractId: c._id,
                              amountPaise: pending > 0 ? pending : f.monthlyAmountPaise,
                              category: PayoutCategory.CONTRACT_FEE,
                            })
                          }
                        >
                          <Send className="mr-1 h-3 w-3" /> Pay
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No contractors linked to this contract</p>
              <p className="mb-3 mt-1 max-w-sm text-xs text-muted-foreground">
                Link team members or external freelancers who are paid a monthly fee from this client retainer.
              </p>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add contractors
              </Button>
            </div>
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
        <Tile span={4} title="All time billing">
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

      {/* Invoice history */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Invoice history</h2>
          {history.length > 0 && <p className="text-xs text-muted-foreground">Drafts and written-off invoices aren’t counted in the totals.</p>}
        </div>
        <DataTable
          columns={invoiceColumns}
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

      {/* Payout history */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Contract payout history</h2>
          <Button size="sm" variant="outline" onClick={() => openLogPayment({ contractId: c._id, category: PayoutCategory.CONTRACT_FEE })}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Log payment
          </Button>
        </div>
        <DataTable
          columns={payoutColumns}
          rows={contractPayouts.data?.items ?? []}
          rowKey={(p) => p._id}
          loading={contractPayouts.isLoading}
          error={contractPayouts.error}
          onRetry={() => contractPayouts.refetch()}
          empty={
            <EmptyState
              illustration="money"
              title="No payouts logged yet"
              description="Payouts logged for this contract will appear here and deduct from contractor balances."
              action={
                <Button size="sm" variant="outline" onClick={() => openLogPayment({ contractId: c._id, category: PayoutCategory.CONTRACT_FEE })}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Log first payment
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
