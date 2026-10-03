// Invoice detail (OWNER-only) — balance jar, payment story, line items and the actions that move an
// invoice through its life: mark as sent (locks amounts), record / remove payments, write off,
// reopen, duplicate, delete (drafts only), PDF.
'use client';

import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  Download,
  Lock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState, type ReactNode } from 'react';

import { InvoiceStatus, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import {
  ActivityTimeline,
  Avatar,
  Bento,
  FillJar,
  Legend,
  Price,
  ProjectChip,
  SegmentBar,
  Tile,
  formatCompact,
  useCanSeePrices,
  type TimelineItem,
} from '@/components/viz';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { formatDate, formatPaise } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';

import { InvoiceFormDialog, termsLabel } from '@/features/invoices/invoice-form-dialog';
import {
  useDeleteInvoice,
  useDuplicateInvoice,
  useInvoice,
  useRemoveInvoicePayment,
  useReopenInvoice,
  useSendInvoice,
  type InvoiceRow,
} from '@/features/invoices/invoices.hooks';
import { PaidStamp } from '@/features/invoices/paid-stamp';
import { RecordPaymentSheet } from '@/features/invoices/record-payment-sheet';
import { WriteOffDialog } from '@/features/invoices/write-off-dialog';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Only the owner can see invoices.</p>}>
      <Inner id={id} />
    </RoleGate>
  );
}

const OPEN = new Set<InvoiceStatus>([InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]);
const time = (d: string | undefined) => (d ? Date.parse(d) || 0 : 0);

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const canSeePrices = useCanSeePrices();
  const inv = useInvoice(id);
  const send = useSendInvoice();
  const remove = useDeleteInvoice();
  const duplicate = useDuplicateInvoice();
  const reopen = useReopenInvoice();
  const removePayment = useRemoveInvoicePayment();

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  if (inv.isLoading) return <PageSkeleton />;
  if (inv.error instanceof ApiRequestError && inv.error.status === 404) {
    return (
      <EmptyState
        illustration="files"
        title="Invoice not found"
        description="It may have been a draft that was deleted."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/invoices">Back to invoices</Link>
          </Button>
        }
      />
    );
  }
  if (inv.isError || !inv.data) {
    return <ErrorState title="Couldn't open this invoice" error={inv.error} onRetry={() => inv.refetch()} />;
  }

  const i = inv.data;
  const isDraft = i.status === InvoiceStatus.DRAFT;
  const writtenOff = i.status === InvoiceStatus.WRITTEN_OFF;
  const isOpen = OPEN.has(i.status);
  const balance = i.balancePaise ?? Math.max(0, i.totalPaise - i.paidPaise);
  const unpaid = Math.max(0, i.totalPaise - i.paidPaise);
  const paidInFull = !isDraft && !writtenOff && i.totalPaise > 0 && balance === 0;
  const pdfHref = `${env.apiBaseUrl}/invoices/${id}/pdf`;
  const payments = [...i.payments].sort((a, b) => time(a.paidAt) - time(b.paidAt));
  const lastPayment = payments.at(-1);
  // Confirm dialogs take plain strings — only build amounts for viewers allowed to see them.
  const moneyText = (p: number) => (canSeePrices ? formatPaise(p, i.currency) : '');

  const markSent = async () => {
    const ok = await confirm({
      title: `Mark ${i.number} as sent?`,
      description:
        'This locks the amounts: the client, line items, amounts and GST can no longer be edited. You can still change the due date and notes, and start recording payments.',
      confirmText: 'Mark as sent',
    });
    if (ok) send.mutate(id);
  };

  const deleteDraft = async () => {
    const ok = await confirm({
      title: `Delete draft ${i.number}?`,
      description: 'The draft is removed and any milestones it billed go back to pending. This cannot be undone.',
      confirmText: 'Delete draft',
      destructive: true,
    });
    if (ok) remove.mutate(id, { onSuccess: () => router.push('/invoices') });
  };

  const doReopen = async () => {
    const amount = moneyText(unpaid);
    const ok = await confirm({
      title: `Reopen ${i.number}?`,
      description: `The ${amount ? `${amount} ` : 'unpaid '}balance counts as outstanding again and payments can be recorded.`,
      confirmText: 'Reopen',
    });
    if (ok) reopen.mutate(id);
  };

  const doDuplicate = async () => {
    const ok = await confirm({
      title: `Duplicate ${i.number}?`,
      description: `Creates a new draft for ${i.clientName ?? 'the same client'} with the same line items, a new number and today's date. Milestone links are not copied.`,
      confirmText: 'Create draft',
    });
    if (ok) duplicate.mutate(id, { onSuccess: (copy) => router.push(`/invoices/${copy._id}`) });
  };

  const removeOne = async (p: InvoiceRow['payments'][number]) => {
    const amount = moneyText(p.amountPaise);
    const ok = await confirm({
      title: amount ? `Remove the ${amount} payment?` : 'Remove this payment?',
      description: `Received ${formatDate(p.paidAt)}${p.reference ? ` (ref ${p.reference})` : ''}. The balance due goes back up and the invoice status is recalculated.`,
      confirmText: 'Remove payment',
      destructive: true,
    });
    if (ok) removePayment.mutate({ id, paymentId: p._id });
  };

  // Per-project totals, so a combined invoice shows what each project owes.
  const projectName = new Map((i.projects ?? []).map((p) => [p._id, p.name]));
  const projectTotals = new Map<string, number>();
  i.lineItems.forEach((li) => {
    const key = li.projectId ?? '';
    projectTotals.set(key, (projectTotals.get(key) ?? 0) + Math.round(li.qty * li.unitPaise));
  });
  const splitName = (pid: string) => (pid ? (projectName.get(pid) ?? 'Deleted project') : 'Not linked to a project');

  const dueText = i.dueDate
    ? i.issueDate && i.dueDate.slice(0, 10) === i.issueDate.slice(0, 10)
      ? 'Due on receipt'
      : `Due ${formatDate(i.dueDate)}`
    : null;

  // The payment story: issued → sent → each payment → written off.
  const story: (TimelineItem & { at: number; order: number })[] = [];
  if (i.issueDate)
    story.push({
      key: 'issued',
      at: time(i.issueDate),
      order: 0,
      date: i.issueDate,
      title: isDraft ? 'Drafted' : 'Issued',
      meta: formatDate(i.issueDate),
      color: 'hsl(var(--muted-foreground))',
    });
  if (i.sentAt)
    story.push({
      key: 'sent',
      at: time(i.sentAt),
      order: 1,
      date: i.sentAt,
      title: 'Marked as sent',
      meta: `${formatDate(i.sentAt)}${dueText ? ` · ${dueText.toLowerCase()}` : ''}`,
      color: 'hsl(var(--info))',
      icon: <Send className="h-2 w-2" />,
    });
  payments.forEach((p, idx) => {
    const settles = paidInFull && idx === payments.length - 1;
    story.push({
      key: p._id,
      at: time(p.paidAt),
      order: 2,
      date: p.paidAt,
      color: 'hsl(var(--success))',
      icon: <Check className="h-2.5 w-2.5" strokeWidth={3} />,
      title: (
        <span className="flex items-start justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Price paise={p.amountPaise} currency={i.currency} className="font-semibold" /> received
            {settles && <Badge variant="success">Paid in full</Badge>}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="-mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove payment received ${formatDate(p.paidAt)}`}
            disabled={removePayment.isPending}
            onClick={() => void removeOne(p)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ),
      meta: [formatDate(p.paidAt), p.methodLabel || p.method || 'Method not recorded', p.reference ? `Ref ${p.reference}` : null]
        .filter(Boolean)
        .join(' · '),
    });
  });
  if (writtenOff)
    story.push({
      key: 'written-off',
      at: i.writtenOffAt ? time(i.writtenOffAt) : Number.MAX_SAFE_INTEGER,
      order: 3,
      date: i.writtenOffAt ?? '',
      title: 'Written off',
      meta: [i.writtenOffAt ? formatDate(i.writtenOffAt) : null, i.writeOffReason ? `“${i.writeOffReason}”` : null].filter(Boolean).join(' · '),
      color: 'hsl(var(--muted-foreground))',
      icon: <Ban className="h-2 w-2" />,
    });
  story.sort((a, b) => a.at - b.at || a.order - b.order);

  const balanceColor = writtenOff
    ? 'hsl(var(--muted-foreground))'
    : i.isOverdue
      ? 'hsl(var(--destructive))'
      : 'hsl(var(--warning))';

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.number}
        crumbs={[{ label: 'Invoices', href: '/invoices' }]}
        eyebrow={
          i.clientName ? (
            <Link href={`/clients/${i.clientId}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:underline">
              <Avatar id={i.clientId} name={i.clientName} size="xs" />
              {i.clientName}
              {i.clientDeleted && <span className="font-normal text-muted-foreground">(deleted)</span>}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border border-dashed" aria-hidden />
              Deleted client
            </span>
          )
        }
        meta={
          <>
            <StatusBadge status={i.status} />
            {i.isOverdue && i.status !== InvoiceStatus.OVERDUE && <Badge variant="danger">Overdue</Badge>}
          </>
        }
        description={
          <>
            {i.issueDate ? <>Issued {formatDate(i.issueDate)}</> : 'Not dated yet'}
            {dueText && (
              <span className={i.isOverdue ? 'font-medium text-destructive' : undefined}>
                {' '}
                · {dueText}
                {i.isOverdue && !!i.daysOverdue && ` · ${i.daysOverdue} day${i.daysOverdue === 1 ? '' : 's'} late`}
              </span>
            )}
          </>
        }
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={pdfHref} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
              </a>
            </Button>
            {isDraft && (
              <Button size="sm" variant="brand" onClick={() => void markSent()} disabled={send.isPending}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> {send.isPending ? 'Marking…' : 'Mark as sent'}
              </Button>
            )}
            {isOpen && balance > 0 && (
              <Button size="sm" variant="brand" onClick={() => setPayOpen(true)}>
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Record payment
              </Button>
            )}
            {writtenOff && (
              <Button size="sm" variant="outline" onClick={() => void doReopen()} disabled={reopen.isPending}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reopen
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  {isDraft ? 'Edit draft' : 'Edit due date & notes'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void doDuplicate()} disabled={duplicate.isPending || i.clientDeleted}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate as new draft
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isDraft ? (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void deleteDraft()}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete draft
                  </DropdownMenuItem>
                ) : (
                  <>
                    {isOpen && (
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setWriteOffOpen(true)}>
                        <Ban className="mr-2 h-3.5 w-3.5" /> Write off…
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
                      <span className="flex items-center">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </span>
                      <span className="pl-5 text-xs">Only drafts can be deleted{isOpen ? ' — write it off instead' : ''}.</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {isDraft && (
        <Banner icon={Pencil}>
          This is a draft — nothing has been sent. Mark it as sent once the client has it; that locks the amounts and lets you record payments.
        </Banner>
      )}
      {writtenOff && (
        <Banner icon={Ban}>
          Written off{i.writtenOffAt ? ` on ${formatDate(i.writtenOffAt)}` : ''}
          {i.writeOffReason ? <> — “{i.writeOffReason}”</> : null}. The unpaid <Price paise={unpaid} currency={i.currency} /> no longer counts
          as outstanding.
        </Banner>
      )}
      {i.isOverdue && (
        <Banner icon={AlertTriangle} tone="danger">
          <Price paise={balance} currency={i.currency} /> is {i.daysOverdue ? `${i.daysOverdue} day${i.daysOverdue === 1 ? '' : 's'} ` : ''}overdue
          {i.dueDate ? ` (was due ${formatDate(i.dueDate)})` : ''}.
        </Banner>
      )}

      <Bento>
        {/* Balance: jar + paid/due bar + the three figures. */}
        <Tile span={5} title={writtenOff ? 'Written off' : 'Balance due'} className={cn('relative overflow-hidden', writtenOff && 'bg-muted/40')}>
          <div className="flex items-center gap-5">
            <FillJar
              size="lg"
              value={i.paidPaise}
              max={i.totalPaise}
              className={cn(writtenOff && 'opacity-50 grayscale')}
              label={i.totalPaise > 0 ? `${Math.round(Math.min(1, i.paidPaise / i.totalPaise) * 100)}% paid` : 'Nothing billed'}
            />
            <div className="min-w-0">
              <Price
                paise={writtenOff ? unpaid : balance}
                currency={i.currency}
                className={cn(
                  'font-display block text-[2.1rem] font-bold leading-none',
                  writtenOff ? 'text-muted-foreground line-through' : i.isOverdue ? 'text-destructive' : paidInFull && 'text-success',
                )}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {writtenOff ? (
                  'No longer counted as outstanding'
                ) : paidInFull ? (
                  'Nothing left to collect'
                ) : isDraft ? (
                  'Not sent yet'
                ) : (
                  <>
                    still due of <Price paise={i.totalPaise} currency={i.currency} />
                  </>
                )}
              </p>
            </div>
          </div>
          {paidInFull && <PaidStamp date={lastPayment?.paidAt} className="absolute right-4 top-3 sm:right-6 sm:top-5" />}

          {i.totalPaise > 0 && (
            <div className="mt-5">
              <SegmentBar
                height="h-3"
                showLabels={false}
                segments={[
                  {
                    value: i.paidPaise,
                    color: writtenOff ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--success))',
                    label: 'Received',
                    display: canSeePrices ? formatPaise(i.paidPaise, i.currency) : '',
                  },
                  {
                    value: writtenOff ? unpaid : balance,
                    color: balanceColor,
                    label: writtenOff ? 'Written off' : 'Still due',
                    display: canSeePrices ? formatPaise(writtenOff ? unpaid : balance, i.currency) : '',
                  },
                ]}
              />
              <Legend
                className="mt-2"
                items={[
                  { color: writtenOff ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--success))', label: 'Received' },
                  { color: balanceColor, label: writtenOff ? 'Written off' : 'Still due' },
                ]}
              />
            </div>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-sm">
            <Figure label="Total">
              <Price paise={i.totalPaise} currency={i.currency} className="font-semibold" />
              <span className="block text-[11px] text-muted-foreground">{i.gstPercent ? `incl. ${i.gstPercent}% GST` : 'No GST'}</span>
            </Figure>
            <Figure label="Received">
              <Price paise={i.paidPaise} currency={i.currency} className={cn('font-semibold', i.paidPaise > 0 && !writtenOff && 'text-success')} />
              <span className="block text-[11px] text-muted-foreground">
                {i.payments.length === 0 ? 'No payments yet' : `${i.payments.length} payment${i.payments.length === 1 ? '' : 's'}`}
              </span>
            </Figure>
            <Figure label={writtenOff ? 'Written off' : 'Balance'}>
              <Price
                paise={writtenOff ? unpaid : balance}
                currency={i.currency}
                className={cn('font-semibold', writtenOff ? 'text-muted-foreground' : i.isOverdue && 'text-destructive')}
              />
            </Figure>
          </dl>
        </Tile>

        {/* Payment story. */}
        <Tile
          span={7}
          title="Payments"
          action={
            isOpen && balance > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Record payment
              </Button>
            ) : undefined
          }
        >
          <ActivityTimeline items={story} />
          {payments.length === 0 && (
            <p className={cn('text-sm text-muted-foreground', story.length > 0 && 'mt-5 border-t pt-4')}>
              {isDraft
                ? 'Send the invoice first — payments can be recorded once it has been sent.'
                : writtenOff
                  ? 'No payments were received before this invoice was written off.'
                  : 'No payments recorded yet.'}
            </p>
          )}
        </Tile>

        {/* Line items. */}
        <Tile
          span={8}
          title="Line items"
          action={
            !isDraft ? (
              <Tooltip content="Sent invoices can't change amounts. Write it off and duplicate it to reissue.">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Locked{i.sentAt ? ` since ${formatDate(i.sentAt)}` : ''}
                </span>
              </Tooltip>
            ) : undefined
          }
        >
          <div className="-mx-1 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Description</TH>
                  <TH className="hidden md:table-cell">Project</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="hidden text-right sm:table-cell">Unit price</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {i.lineItems.map((li, idx) => (
                  <TR key={idx}>
                    <TD>
                      {li.description}
                      {li.projectId && (
                        <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">{projectName.get(li.projectId) ?? 'Deleted project'}</span>
                      )}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {li.projectId ? (
                        projectName.get(li.projectId) ? (
                          <ProjectChip id={li.projectId} name={projectName.get(li.projectId)!} href={`/projects/${li.projectId}`} />
                        ) : (
                          'Deleted project'
                        )
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right font-figures">{li.qty}</TD>
                    <TD className="hidden text-right sm:table-cell">
                      <Price paise={li.unitPaise} currency={i.currency} />
                    </TD>
                    <TD className="text-right">
                      <Price paise={Math.round(li.qty * li.unitPaise)} currency={i.currency} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {projectTotals.size > 1 && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Split across projects</p>
              <SegmentBar
                height="h-2.5"
                showLabels={false}
                segments={[...projectTotals.entries()].map(([pid, paise]) => ({
                  value: paise,
                  color: pid ? identityColor(pid) : 'hsl(var(--muted-foreground) / 0.5)',
                  label: splitName(pid),
                  display: canSeePrices ? formatCompact(paise, i.currency) : '',
                }))}
              />
              <div className="mt-2.5 space-y-1">
                {[...projectTotals.entries()].map(([pid, paise]) => (
                  <div key={pid || 'unassigned'} className="flex items-center justify-between gap-3">
                    {pid && projectName.get(pid) ? (
                      <ProjectChip id={pid} name={projectName.get(pid)!} href={`/projects/${pid}?tab=billing`} className="text-muted-foreground" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden />
                        {splitName(pid)}
                      </span>
                    )}
                    <Price paise={paise} currency={i.currency} className="font-medium" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">
              <Price paise={i.subTotalPaise} currency={i.currency} />
            </dd>
            <dt className="text-muted-foreground">GST {i.gstPercent ? `${i.gstPercent}%` : ''}</dt>
            <dd className="text-right">
              <Price paise={i.gstPaise} currency={i.currency} />
            </dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-semibold">
              <Price paise={i.totalPaise} currency={i.currency} />
            </dd>
            {i.paidPaise > 0 && (
              <>
                <dt className="text-muted-foreground">Received</dt>
                <dd className="text-right text-success">
                  −<Price paise={i.paidPaise} currency={i.currency} />
                </dd>
              </>
            )}
            <dt className="font-medium">{writtenOff ? 'Written off' : 'Balance due'}</dt>
            <dd className={cn('text-right font-semibold', writtenOff && 'text-muted-foreground')}>
              <Price paise={writtenOff ? unpaid : balance} currency={i.currency} />
            </dd>
          </dl>
        </Tile>

        {/* Details: dates, terms, related records, notes. */}
        <Tile span={4} title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Issued</dt>
            <dd className="text-right">{i.issueDate ? formatDate(i.issueDate) : '—'}</dd>
            <dt className="text-muted-foreground">Due</dt>
            <dd className={cn('text-right', i.isOverdue && 'font-medium text-destructive')}>{i.dueDate ? formatDate(i.dueDate) : '—'}</dd>
            {i.clientPaymentTermsDays !== undefined && (
              <>
                <dt className="text-muted-foreground">Client terms</dt>
                <dd className="text-right">{termsLabel(i.clientPaymentTermsDays)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Sent</dt>
            <dd className="text-right">{i.sentAt ? formatDate(i.sentAt) : 'Not yet'}</dd>
          </dl>

          {((i.projects?.length ?? 0) > 0 || (i.contracts?.length ?? 0) > 0) && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Related</p>
              <div className="flex flex-col gap-1.5 text-sm">
                {(i.projects ?? []).map((p) =>
                  p.name ? (
                    <ProjectChip key={p._id} id={p._id} name={p.name} href={`/projects/${p._id}?tab=billing`} />
                  ) : (
                    <span key={p._id} className="text-muted-foreground">
                      Deleted project
                    </span>
                  ),
                )}
                {(i.contracts ?? []).map((c) =>
                  c.name ? (
                    <Link key={c._id} href={`/contracts/${c._id}`} className="hover:underline">
                      Retainer · {c.name}
                    </Link>
                  ) : (
                    <span key={c._id} className="text-muted-foreground">
                      Deleted contract
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            {i.notes ? (
              <p className="mt-1 whitespace-pre-line text-sm">{i.notes}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No notes.{' '}
                <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setEditOpen(true)}>
                  Add one
                </button>
              </p>
            )}
          </div>
        </Tile>
      </Bento>

      <InvoiceFormDialog open={editOpen} onOpenChange={setEditOpen} invoice={i} />
      <RecordPaymentSheet invoice={i} open={payOpen} onOpenChange={setPayOpen} />
      <WriteOffDialog invoice={i} open={writeOffOpen} onOpenChange={setWriteOffOpen} />
    </div>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function Banner({
  icon: Icon,
  tone = 'muted',
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'muted' | 'danger';
  children: ReactNode;
}) {
  return (
    <div
      className={
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ' +
        (tone === 'danger' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'bg-muted/40 text-muted-foreground')
      }
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
