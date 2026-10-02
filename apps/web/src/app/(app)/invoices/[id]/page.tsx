// Invoice detail (OWNER-only) — balance, line items, payments and the actions that move an
// invoice through its life: mark as sent (locks amounts), record / remove payments, write off,
// reopen, duplicate, delete (drafts only).
'use client';

import {
  AlertTriangle,
  Ban,
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
import { use, useState } from 'react';

import { InvoiceStatus, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ApiRequestError } from '@/lib/api-client';
import { env } from '@/lib/env';
import { formatDate, formatPaise } from '@/lib/formatters';

import { InvoiceFormDialog } from '@/features/invoices/invoice-form-dialog';
import {
  useDeleteInvoice,
  useDuplicateInvoice,
  useInvoice,
  useRemoveInvoicePayment,
  useReopenInvoice,
  useSendInvoice,
  type InvoiceRow,
} from '@/features/invoices/invoices.hooks';
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

const OPEN = new Set<InvoiceStatus>([InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE]);

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
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
  const money = (p: number) => formatPaise(p, i.currency);
  const pdfHref = `${env.apiBaseUrl}/invoices/${id}/pdf`;

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
    const ok = await confirm({
      title: `Reopen ${i.number}?`,
      description: `The ${money(Math.max(0, i.totalPaise - i.paidPaise))} balance counts as outstanding again and payments can be recorded.`,
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
    const ok = await confirm({
      title: `Remove the ${money(p.amountPaise)} payment?`,
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

  return (
    <div className="space-y-5">
      <PageHeader
        title={i.number}
        crumbs={[{ label: 'Invoices', href: '/invoices' }]}
        meta={
          <>
            <StatusBadge status={i.status} />
            {i.isOverdue && i.status !== InvoiceStatus.OVERDUE && <Badge variant="danger">Overdue</Badge>}
          </>
        }
        description={
          <>
            {i.clientName ? (
              <Link href={`/clients/${i.clientId}`} className="font-medium text-foreground hover:underline">
                {i.clientName}
              </Link>
            ) : (
              <span>Deleted client</span>
            )}
            {i.issueDate && <> · Issued {formatDate(i.issueDate)}</>}
            {i.dueDate && (
              <span className={i.isOverdue ? 'text-destructive' : undefined}>
                {' '}
                · {i.issueDate && i.dueDate.slice(0, 10) === i.issueDate.slice(0, 10) ? 'Due on receipt' : `Due ${formatDate(i.dueDate)}`}
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
              <Button size="sm" onClick={() => void markSent()} disabled={send.isPending}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> {send.isPending ? 'Marking…' : 'Mark as sent'}
              </Button>
            )}
            {isOpen && balance > 0 && (
              <Button size="sm" onClick={() => setPayOpen(true)}>
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
          {i.writeOffReason ? <> — “{i.writeOffReason}”</> : null}. The unpaid{' '}
          {money(Math.max(0, i.totalPaise - i.paidPaise))} no longer counts as outstanding.
        </Banner>
      )}
      {i.isOverdue && (
        <Banner icon={AlertTriangle} tone="danger">
          {money(balance)} is {i.daysOverdue ? `${i.daysOverdue} day${i.daysOverdue === 1 ? '' : 's'} ` : ''}overdue
          {i.dueDate ? ` (was due ${formatDate(i.dueDate)})` : ''}.
        </Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3 sm:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">Balance due</p>
          <p
            className={
              'mt-1 text-3xl font-semibold tabular-nums tracking-tight ' +
              (writtenOff ? 'text-muted-foreground line-through' : i.isOverdue ? 'text-destructive' : balance === 0 ? 'text-[hsl(var(--success))]' : '')
            }
          >
            {money(writtenOff ? Math.max(0, i.totalPaise - i.paidPaise) : balance)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {writtenOff ? 'Written off' : balance === 0 && i.totalPaise > 0 ? 'Paid in full' : isDraft ? 'Not sent yet' : `of ${money(i.totalPaise)}`}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{money(i.totalPaise)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {money(i.subTotalPaise)} + {i.gstPercent ? `${i.gstPercent}% GST` : 'no GST'}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Received</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[hsl(var(--success))]">{money(i.paidPaise)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {i.payments.length === 0 ? 'No payments yet' : `${i.payments.length} payment${i.payments.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Line items</CardTitle>
          {!isDraft && (
            <Tooltip content="Sent invoices can't change amounts. Write it off and duplicate it to reissue.">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Locked{i.sentAt ? ` since ${formatDate(i.sentAt)}` : ''}
              </span>
            </Tooltip>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Description</TH>
                  <TH className="hidden md:table-cell">Project</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Unit price</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {i.lineItems.map((li, idx) => (
                  <TR key={idx}>
                    <TD>{li.description}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {li.projectId ? (
                        projectName.get(li.projectId) ? (
                          <Link href={`/projects/${li.projectId}`} className="hover:underline">
                            {projectName.get(li.projectId)}
                          </Link>
                        ) : (
                          'Deleted project'
                        )
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{li.qty}</TD>
                    <TD className="text-right tabular-nums">{money(li.unitPaise)}</TD>
                    <TD className="text-right tabular-nums">{money(Math.round(li.qty * li.unitPaise))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {projectTotals.size > 1 && (
            <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Split across projects</p>
              {[...projectTotals.entries()].map(([pid, paise]) => (
                <div key={pid || 'unassigned'} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">
                    {pid ? (projectName.get(pid) ?? 'Deleted project') : 'Not linked to a project'}
                  </span>
                  <span className="font-medium tabular-nums">{money(paise)}</span>
                </div>
              ))}
            </div>
          )}

          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{money(i.subTotalPaise)}</dd>
            <dt className="text-muted-foreground">GST {i.gstPercent ? `${i.gstPercent}%` : ''}</dt>
            <dd className="text-right">{money(i.gstPaise)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-semibold">{money(i.totalPaise)}</dd>
            {i.paidPaise > 0 && (
              <>
                <dt className="text-muted-foreground">Received</dt>
                <dd className="text-right text-[hsl(var(--success))]">−{money(i.paidPaise)}</dd>
              </>
            )}
            <dt className="font-medium">{writtenOff ? 'Written off' : 'Balance due'}</dt>
            <dd className="text-right font-semibold">{money(writtenOff ? Math.max(0, i.totalPaise - i.paidPaise) : balance)}</dd>
          </dl>

          {i.notes && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm">{i.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Payments</CardTitle>
          {isOpen && balance > 0 && (
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
              Record payment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {i.payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {isDraft
                ? 'Send the invoice first — payments can be recorded once it has been sent.'
                : writtenOff
                  ? 'No payments were received before this invoice was written off.'
                  : 'No payments recorded yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Reference</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="w-10">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {i.payments.map((p) => (
                    <TR key={p._id}>
                      <TD className="whitespace-nowrap">{formatDate(p.paidAt)}</TD>
                      <TD>{p.methodLabel || p.method || '—'}</TD>
                      <TD className="text-muted-foreground">{p.reference || '—'}</TD>
                      <TD className="text-right font-medium tabular-nums">{money(p.amountPaise)}</TD>
                      <TD>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Remove payment"
                          disabled={removePayment.isPending}
                          onClick={() => void removeOne(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {((i.projects?.length ?? 0) > 0 || (i.contracts?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(i.projects ?? []).map((p) =>
              p.name ? (
                <Link
                  key={p._id}
                  href={`/projects/${p._id}?tab=billing`}
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Project · {p.name}
                </Link>
              ) : (
                <span key={p._id} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
                  Deleted project
                </span>
              ),
            )}
            {(i.contracts ?? []).map((c) =>
              c.name ? (
                <Link
                  key={c._id}
                  href={`/contracts/${c._id}`}
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Contract · {c.name}
                </Link>
              ) : (
                <span key={c._id} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
                  Deleted contract
                </span>
              ),
            )}
          </CardContent>
        </Card>
      )}

      <InvoiceFormDialog open={editOpen} onOpenChange={setEditOpen} invoice={i} />
      <RecordPaymentSheet invoice={i} open={payOpen} onOpenChange={setPayOpen} />
      <WriteOffDialog invoice={i} open={writeOffOpen} onOpenChange={setWriteOffOpen} />
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
  children: React.ReactNode;
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
