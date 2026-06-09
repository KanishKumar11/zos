// Project detail.
'use client';

import { use, useRef, useState } from 'react';

import { Role } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import {
  useProject, useSetMemberCost,
  useAddMemberPayment, useRemoveMemberPayment,
  type MemberPaymentEntry,
} from '@/features/projects/projects.hooks';
import { useTeamList } from '@/features/team/team.hooks';
import { useFreelancerPaymentsByProject } from '@/features/freelancer-payments/freelancer-payments.hooks';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const team = useTeamList({ pageSize: 100 });
  const invoices = useInvoices({ projectId: id });
  const freelancerPayments = useFreelancerPaymentsByProject(isOwner ? id : undefined);

  if (project.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const p = project.data;

  const nameMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));
  const cur = p.currency ?? 'INR';
  const totalDevCost = (p.clientBudgetPaise ?? 0) - (p.agencyMarginPaise ?? 0);
  const invList = invoices.data ?? [];
  const invoiceTotal = invList.reduce((s, i) => s + i.totalPaise, 0);
  const clientReceived = invList.reduce((s, i) => s + i.paidPaise, 0);
  const memberBudgeted = p.members.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
  const memberPaid = p.members.reduce((s, m) => s + m.payments.reduce((ps, pay) => ps + pay.amountPaise, 0), 0);
  const freelancerList = freelancerPayments.data ?? [];
  const freelancerAgreed = freelancerList.reduce((s, f) => s + f.agreedTotalPaise, 0);
  const freelancerPaid = freelancerList.reduce((s, f) => s + f.paidPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={p.name} description={`${p.code} · ${p.status}`} />

      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{p.brief || 'No brief recorded.'}</p>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Client budget</p>
              <p className="text-lg font-semibold">{formatPaise(p.clientBudgetPaise ?? 0, cur)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Dev cost</p>
              <p className="text-lg font-semibold text-amber-600">{formatPaise(totalDevCost, cur)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Agency margin</p>
              <p className="text-lg font-semibold text-green-600">{formatPaise(p.agencyMarginPaise ?? 0, cur)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <SyncCard
          currency={cur}
          clientBudgetPaise={p.clientBudgetPaise ?? 0}
          devCostPaise={totalDevCost}
          invoiceTotal={invoiceTotal}
          clientReceived={clientReceived}
          memberBudgeted={memberBudgeted}
          memberPaid={memberPaid}
          freelancerAgreed={freelancerAgreed}
          freelancerPaid={freelancerPaid}
        />
      )}

      {isOwner && (invoices.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Client Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(invoices.data ?? []).map((inv) => {
              const outstanding = inv.totalPaise - inv.paidPaise;
              return (
                <div key={inv._id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{inv.number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        Total: {formatPaise(inv.totalPaise, inv.currency)}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </div>
                  {inv.payments.length > 0 ? (
                    <div className="space-y-1">
                      {inv.payments.map((pay) => (
                        <div key={pay._id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {new Date(pay.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {pay.reference ? ` · ${pay.reference}` : ''}
                          </span>
                          <span className="font-medium text-green-700">+{formatPaise(pay.amountPaise, inv.currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No payments received yet</p>
                  )}
                  {outstanding > 0 && (
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className="font-semibold text-amber-600">{formatPaise(outstanding, inv.currency)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {isOwner && freelancerList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Freelancer Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Agreed</TH>
                  <TH>Paid</TH>
                  <TH>Pending</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {freelancerList.map((fp) => (
                  <TR key={fp._id}>
                    <TD className="font-medium">{fp.freelancerName}</TD>
                    <TD>{formatPaise(fp.agreedTotalPaise, fp.currency)}</TD>
                    <TD className="text-green-700 font-medium">{formatPaise(fp.paidPaise, fp.currency)}</TD>
                    <TD className="text-amber-600">{formatPaise(fp.pendingPaise, fp.currency)}</TD>
                    <TD>
                      <span className={`text-xs px-2 py-1 rounded ${fp.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : fp.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {fp.status}
                      </span>
                    </TD>
                  </TR>
                ))}
                <TR>
                  <TD colSpan={1} className="text-right text-xs text-muted-foreground font-semibold">Total</TD>
                  <TD className="font-semibold">{formatPaise(freelancerAgreed, cur)}</TD>
                  <TD className="font-semibold text-green-700">{formatPaise(freelancerPaid, cur)}</TD>
                  <TD className="font-semibold text-amber-600">{formatPaise(freelancerAgreed - freelancerPaid, cur)}</TD>
                  <TD></TD>
                </TR>
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members ({p.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Added</TH>
                {isOwner && <TH>Budgeted Pay</TH>}
                {isOwner && <TH>Paid</TH>}
              </TR>
            </THead>
            <TBody>
              {p.members.map((m) => {
                const paid = m.payments.reduce((s, pay) => s + pay.amountPaise, 0);
                return (
                  <MemberRow
                    key={m.userId}
                    projectId={id}
                    member={m}
                    name={nameMap.get(m.userId) ?? m.userId.slice(-6)}
                    currency={cur}
                    isOwner={isOwner}
                    paidTotal={paid}
                  />
                );
              })}
              {isOwner && p.members.length > 0 && (
                <TR>
                  <TD colSpan={3} className="text-right text-xs text-muted-foreground">Total</TD>
                  <TD className="font-semibold">{formatPaise(memberBudgeted, cur)}</TD>
                  <TD className="font-semibold text-green-700">{formatPaise(memberPaid, cur)}</TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Member Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.members.map((m) => (
              <MemberPaymentBlock
                key={m.userId}
                projectId={id}
                member={m}
                name={nameMap.get(m.userId) ?? m.userId.slice(-6)}
                currency={cur}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SyncRow({
  label, leftLabel, leftValue, rightLabel, rightValue, currency, invert = false,
}: {
  label: string; leftLabel: string; leftValue: number;
  rightLabel: string; rightValue: number; currency: string; invert?: boolean;
}) {
  const diff = leftValue - rightValue;
  const ok = diff === 0;
  // invert: flag when left > right (e.g. team paid more than client paid us)
  const warn = invert ? leftValue > rightValue : Math.abs(diff) > 0;
  return (
    <div className={`rounded border p-3 space-y-1 ${warn && !ok ? 'border-red-200 bg-red-50' : ok ? 'border-green-200 bg-green-50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-semibold ${ok ? 'text-green-700' : warn ? 'text-red-600' : 'text-amber-600'}`}>
          {ok ? '✓ Match' : warn ? `⚠ ${formatPaise(Math.abs(diff), currency)} gap` : `${formatPaise(Math.abs(diff), currency)} gap`}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{leftLabel}</span>
        <span className="font-medium">{formatPaise(leftValue, currency)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{rightLabel}</span>
        <span className="font-medium">{formatPaise(rightValue, currency)}</span>
      </div>
    </div>
  );
}

function SyncCard({
  currency, clientBudgetPaise, devCostPaise, invoiceTotal, clientReceived, memberBudgeted, memberPaid, freelancerAgreed, freelancerPaid,
}: {
  currency: string; clientBudgetPaise: number; devCostPaise: number;
  invoiceTotal: number; clientReceived: number; memberBudgeted: number; memberPaid: number;
  freelancerAgreed: number; freelancerPaid: number;
}) {
  const totalPayoutsExpense = memberPaid + freelancerPaid;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Check</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <SyncRow
          label="Budget vs Invoice"
          leftLabel="Project budget"
          leftValue={clientBudgetPaise}
          rightLabel="Invoice total"
          rightValue={invoiceTotal}
          currency={currency}
        />
        <SyncRow
          label="Dev cost vs Expenses"
          leftLabel="Dev cost (budget − margin)"
          leftValue={devCostPaise}
          rightLabel="Total expenses (members + freelancers)"
          rightValue={memberBudgeted + freelancerAgreed}
          currency={currency}
        />
        <SyncRow
          label="Cash flow"
          leftLabel="Total paid out (members + freelancers)"
          leftValue={totalPayoutsExpense}
          rightLabel="Client received"
          rightValue={clientReceived}
          currency={currency}
          invert
        />
      </CardContent>
    </Card>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
    UNPAID: 'bg-slate-100 text-slate-700',
    OVERDUE: 'bg-red-100 text-red-800',
    WRITTEN_OFF: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${variants[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function EditableCell({
  initialPaise,
  currency,
  onSave,
}: {
  initialPaise: number;
  currency: string;
  onSave: (paise: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [displayPaise, setDisplayPaise] = useState<number | null>(null);
  const committed = useRef(false);
  const dirty = useRef(false);

  const shownPaise = displayPaise ?? initialPaise;

  const startEdit = () => {
    committed.current = false;
    dirty.current = false;
    setDraft(String(Math.round(shownPaise / 100)));
    setEditing(true);
  };

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    setEditing(false);
    if (!dirty.current) return;
    const inr = parseFloat(draft);
    if (!isNaN(inr) && inr >= 0) {
      const paise = Math.round(inr * 100);
      setDisplayPaise(paise);
      onSave(paise);
    }
  };

  const cancel = () => { committed.current = true; setEditing(false); };

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        min={0}
        className="h-7 w-28 text-sm"
        value={draft}
        onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') cancel();
        }}
      />
    );
  }

  return (
    <button className="rounded px-1 text-left hover:bg-muted" onClick={startEdit} title="Click to edit">
      {shownPaise > 0
        ? formatPaise(shownPaise, currency)
        : <span className="text-muted-foreground">— click to set</span>}
    </button>
  );
}

function MemberRow({
  projectId,
  member,
  name,
  currency,
  isOwner,
  paidTotal,
}: {
  projectId: string;
  member: { userId: string; role: string; addedAt: string; amountPaise: number; payments: MemberPaymentEntry[] };
  name: string;
  currency: string;
  isOwner: boolean;
  paidTotal: number;
}) {
  const setCost = useSetMemberCost();

  return (
    <TR>
      <TD className="font-medium">{name}</TD>
      <TD>{member.role}</TD>
      <TD>{new Date(member.addedAt).toLocaleDateString()}</TD>
      {isOwner && (
        <TD>
          <EditableCell
            initialPaise={member.amountPaise ?? 0}
            currency={currency}
            onSave={(paise) => setCost.mutate({ id: projectId, userId: member.userId, amountPaise: paise })}
          />
        </TD>
      )}
      {isOwner && (
        <TD className="text-green-700 font-medium">
          {paidTotal > 0 ? formatPaise(paidTotal, currency) : <span className="text-muted-foreground">₹0</span>}
        </TD>
      )}
    </TR>
  );
}

function MemberPaymentBlock({
  projectId, member, name, currency,
}: {
  projectId: string;
  member: { userId: string; amountPaise: number; payments: MemberPaymentEntry[] };
  name: string;
  currency: string;
}) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const add = useAddMemberPayment();
  const remove = useRemoveMemberPayment();

  const paidTotal = member.payments.reduce((s, p) => s + p.amountPaise, 0);
  const remaining = (member.amountPaise ?? 0) - paidTotal;

  const save = () => {
    const paise = Math.round(parseFloat(amount) * 100);
    if (isNaN(paise) || paise <= 0) return;
    add.mutate({ id: projectId, userId: member.userId, amountPaise: paise, paidAt: date, note: note || undefined });
    setAdding(false);
    setAmount('');
    setNote('');
  };

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{name}</span>
          <span className="ml-3 text-xs text-muted-foreground">
            Budgeted: {formatPaise(member.amountPaise ?? 0, currency)}
            {' · '}Paid: {formatPaise(paidTotal, currency)}
            {remaining > 0 && <span className="text-amber-600"> · ₹{Math.round(remaining / 100).toLocaleString('en-IN')} pending</span>}
          </span>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add payment</Button>
        )}
      </div>

      {member.payments.length > 0 && (
        <div className="space-y-1">
          {member.payments.map((pay) => (
            <div key={pay._id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(pay.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {pay.note ? ` · ${pay.note}` : ''}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-green-700">+{formatPaise(pay.amountPaise, currency)}</span>
                <button
                  className="text-xs text-muted-foreground hover:text-red-500"
                  onClick={() => remove.mutate({ id: projectId, userId: member.userId, paymentId: pay._id })}
                  title="Remove"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex flex-wrap gap-2 items-end border-t pt-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Amount (₹)</label>
            <Input
              type="number" min={1} placeholder="0" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
              className="h-8 w-28 text-sm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <Input placeholder="e.g. Milestone 1" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={save} disabled={add.isPending}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}

      {!adding && member.payments.length === 0 && (
        <p className="text-xs text-muted-foreground">No payments recorded yet</p>
      )}
    </div>
  );
}
