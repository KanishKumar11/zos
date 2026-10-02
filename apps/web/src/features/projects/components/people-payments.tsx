// People & payments (OWNER) — everyone on a project with their agreed fee, what's been paid and
// what's pending, plus the payment history behind each number. One click to log a payment.
'use client';

import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Send, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

import { PAYOUT_METHOD_LABEL, PayeeType, ProjectMemberRole, Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useFreelancers } from '@/features/freelancers/freelancers.hooks';
import { usePayouts, useProjectPayoutBalances, type BalanceRow } from '@/features/payouts/payouts.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

import {
  useAddProjectFreelancer,
  useAddProjectMember,
  useRemoveProjectFreelancer,
  useRemoveProjectMember,
  useSetMemberCost,
  useUpdateProjectFreelancer,
  type ProjectRow,
} from '../projects.hooks';

export function PeoplePayments({ project }: { project: ProjectRow }) {
  const balances = useProjectPayoutBalances(project._id);
  const ledger = usePayouts({ projectId: project._id, pageSize: 500 });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState<'member' | 'freelancer' | null>(null);
  const cur = project.currency ?? 'INR';

  const rows = balances.data ?? [];
  const totals = rows.reduce(
    (t, r) => ({ agreed: t.agreed + r.agreedPaise, paid: t.paid + r.paidPaise, pending: t.pending + r.pendingPaise }),
    { agreed: 0, paid: 0, pending: 0 },
  );
  const roleOf = useMemo(() => new Map(project.members.map((m) => [m.userId, m.role])), [project.members]);
  const historyFor = (r: BalanceRow) =>
    (ledger.data?.items ?? []).filter((p) =>
      r.payeeType === PayeeType.MEMBER ? p.userId === r.payeeId : p.freelancerId === r.payeeId,
    );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>People &amp; payments</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Agreed {formatPaise(totals.agreed, cur)} · paid {formatPaise(totals.paid, cur)} ·{' '}
            <span className={cn(totals.pending > 0 && 'font-medium text-amber-700 dark:text-amber-500')}>
              {formatPaise(totals.pending, cur)} pending
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add person
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAdding('member')}>Team member</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAdding('freelancer')}>Freelancer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openLogPayment({ projectId: project._id })}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
          </Button>
        </div>
      </CardHeader>

      {adding && <AddPersonRow project={project} kind={adding} onDone={() => setAdding(null)} />}

      <CardContent className="p-0">
        {balances.isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : balances.isError ? (
          <ErrorState error={balances.error} onRetry={() => balances.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nobody on this project yet"
            description="Add team members or freelancers with their agreed fee, then log payments against it."
            action={
              <Button size="sm" variant="outline" onClick={() => setAdding('member')}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add team member
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="h-9 w-8" />
                  <th className="h-9 px-3 text-left font-medium">Person</th>
                  <th className="h-9 px-3 text-right font-medium">Agreed</th>
                  <th className="h-9 px-3 text-right font-medium">Paid</th>
                  <th className="hidden h-9 px-3 text-left font-medium md:table-cell">Progress</th>
                  <th className="h-9 px-3 text-right font-medium">Pending</th>
                  <th className="h-9 w-[150px]" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const key = `${r.payeeType}:${r.payeeId}`;
                  const isOpen = expanded === key;
                  const history = historyFor(r);
                  const removed =
                    r.payeeType === PayeeType.MEMBER
                      ? !roleOf.has(r.payeeId)
                      : !(project.freelancers ?? []).some((f) => f.freelancerId === r.payeeId);
                  return (
                    <Fragment key={key}>
                      <tr className={cn('align-middle', removed && 'opacity-70')}>
                        <td className="pl-3">
                          <button
                            type="button"
                            aria-label={isOpen ? 'Hide payments' : 'Show payments'}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                            disabled={r.payoutCount === 0}
                            onClick={() => setExpanded(isOpen ? null : key)}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={r.payeeType === PayeeType.MEMBER ? `/team/${r.payeeId}` : `/freelancers/${r.payeeId}`}
                              className="font-medium hover:underline"
                            >
                              {r.payeeName}
                            </Link>
                            {r.payeeType === PayeeType.FREELANCER ? (
                              <Badge variant="info">Freelancer</Badge>
                            ) : (
                              roleOf.get(r.payeeId) && <Badge variant="muted">{roleLabel(roleOf.get(r.payeeId)!)}</Badge>
                            )}
                            {removed && <Badge variant="outline">Removed from project</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.payoutCount === 0
                              ? 'No payments yet'
                              : `${r.payoutCount} payment${r.payoutCount === 1 ? '' : 's'} · last ${formatDate(r.lastPaidAt!)}`}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {removed ? (
                            <span className="tabular-nums text-muted-foreground">—</span>
                          ) : (
                            <AgreedFeeCell project={project} row={r} />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPaise(r.paidPaise, cur)}</td>
                        <td className="hidden w-[140px] px-3 md:table-cell">
                          {r.agreedPaise > 0 ? <ProgressBar value={r.paidPaise} max={r.agreedPaise} /> : <span className="text-xs text-muted-foreground">No fee set</span>}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right tabular-nums',
                            r.pendingPaise > 0 && 'font-medium text-amber-700 dark:text-amber-500',
                          )}
                        >
                          {r.agreedPaise > 0 && r.paidPaise > r.agreedPaise ? (
                            <span className="text-xs text-amber-700 dark:text-amber-500">
                              {formatPaise(r.paidPaise - r.agreedPaise, cur)} over
                            </span>
                          ) : (
                            formatPaise(r.pendingPaise, cur)
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {!removed && (
                              <Button
                                size="sm"
                                variant={r.pendingPaise > 0 ? 'default' : 'outline'}
                                className="h-7 px-2.5 text-xs"
                                onClick={() =>
                                  openLogPayment({
                                    payeeType: r.payeeType,
                                    userId: r.payeeType === PayeeType.MEMBER ? r.payeeId : undefined,
                                    freelancerId: r.payeeType === PayeeType.FREELANCER ? r.payeeId : undefined,
                                    projectId: project._id,
                                    amountPaise: r.pendingPaise || undefined,
                                  })
                                }
                              >
                                Pay
                              </Button>
                            )}
                            {!removed && <RowMenu project={project} row={r} />}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td />
                          <td colSpan={6} className="px-3 pb-3 pt-1">
                            <ul className="divide-y rounded-md border bg-background">
                              {history.map((p) => (
                                <li key={p._id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                                  <span className="w-24 shrink-0 text-muted-foreground">{formatDate(p.paidAt)}</span>
                                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                    {PAYOUT_METHOD_LABEL[p.method]}
                                    {p.reference ? ` · ${p.reference}` : ''}
                                    {p.note ? ` · ${p.note}` : ''}
                                  </span>
                                  <span className="tabular-nums font-medium">{formatPaise(p.amountPaise, p.currency)}</span>
                                  <button
                                    type="button"
                                    aria-label="Edit payment"
                                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    onClick={() => openLogPayment({}, p._id)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

/** Click-to-edit agreed fee. */
function AgreedFeeCell({ project, row }: { project: ProjectRow; row: BalanceRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | undefined>(row.agreedPaise);
  const setMemberCost = useSetMemberCost();
  const updateFreelancer = useUpdateProjectFreelancer();
  const pending = setMemberCost.isPending || updateFreelancer.isPending;

  const save = async () => {
    const amountPaise = value ?? 0;
    if (amountPaise === row.agreedPaise) return setEditing(false);
    if (row.payeeType === PayeeType.MEMBER) {
      await setMemberCost.mutateAsync({ id: project._id, userId: row.payeeId, amountPaise });
    } else {
      await updateFreelancer.mutateAsync({ id: project._id, freelancerId: row.payeeId, body: { agreedPaise: amountPaise } });
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(row.agreedPaise);
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1 rounded px-1 tabular-nums hover:bg-accent"
        title="Edit agreed fee"
      >
        {row.agreedPaise > 0 ? formatPaise(row.agreedPaise, project.currency ?? 'INR') : <span className="text-muted-foreground">Set fee</span>}
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }
  return (
    <div className="ml-auto flex w-[180px] items-center gap-1">
      <MoneyInput
        autoFocus
        value={value}
        onChange={setValue}
        className="h-8"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <Button size="sm" className="h-8 px-2" disabled={pending} onClick={() => void save()}>
        Save
      </Button>
    </div>
  );
}

function RowMenu({ project, row }: { project: ProjectRow; row: BalanceRow }) {
  const confirm = useConfirm();
  const removeMember = useRemoveProjectMember();
  const removeFreelancer = useRemoveProjectFreelancer();

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${row.payeeName} from ${project.name}?`,
      description:
        row.payoutCount > 0
          ? `Their ${row.payoutCount} payment${row.payoutCount === 1 ? '' : 's'} (${formatPaise(row.paidPaise)}) stay in the ledger and still count towards project cost.`
          : row.payeeType === PayeeType.MEMBER
            ? 'They will lose access to this project.'
            : 'Their agreed fee on this project will be removed.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    if (row.payeeType === PayeeType.MEMBER) await removeMember.mutateAsync({ id: project._id, userId: row.payeeId });
    else await removeFreelancer.mutateAsync({ id: project._id, freelancerId: row.payeeId });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={row.payeeType === PayeeType.MEMBER ? `/team/${row.payeeId}` : `/freelancers/${row.payeeId}`}>
            Open profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/payments?${row.payeeType === PayeeType.MEMBER ? 'userId' : 'freelancerId'}=${row.payeeId}&projectId=${project._id}`}
          >
            All payments
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void remove()}>
          <UserMinus className="mr-2 h-3.5 w-3.5" /> Remove from project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddPersonRow({ project, kind, onDone }: { project: ProjectRow; kind: 'member' | 'freelancer'; onDone: () => void }) {
  const staff = useStaffDirectory({ enabled: kind === 'member' });
  const freelancers = useFreelancers(undefined, { enabled: kind === 'freelancer' });
  const addMember = useAddProjectMember();
  const addFreelancer = useAddProjectFreelancer();
  const [who, setWho] = useState<string | undefined>();
  const [role, setRole] = useState<ProjectMemberRole>(ProjectMemberRole.CONTRIBUTOR);
  const [fee, setFee] = useState<number | undefined>();
  const [error, setError] = useState<string>();

  const taken = new Set(
    kind === 'member' ? project.members.map((m) => m.userId) : (project.freelancers ?? []).map((f) => f.freelancerId),
  );
  const options =
    kind === 'member'
      ? (staff.data ?? [])
          .filter((u) => u.role !== Role.CLIENT)
          .map((u) => ({ value: u._id, label: u.name, description: u.email, disabled: taken.has(u._id) }))
      : (freelancers.data ?? []).map((f) => ({ value: f._id, label: f.name, description: f.skill || f.email, disabled: taken.has(f._id) }));

  const submit = async () => {
    if (!who) return setError(kind === 'member' ? 'Choose a team member' : 'Choose a freelancer');
    if (kind === 'member') {
      await addMember.mutateAsync({ id: project._id, body: { userId: who, role, amountPaise: fee } });
    } else {
      await addFreelancer.mutateAsync({ id: project._id, body: { freelancerId: who, agreedPaise: fee ?? 0 } });
    }
    onDone();
  };

  return (
    <div className="grid gap-3 border-b bg-muted/30 px-5 py-4 sm:grid-cols-[1fr_160px_180px_auto] sm:items-end">
      <FormField label={kind === 'member' ? 'Team member' : 'Freelancer'} error={error}>
        <Combobox
          options={options}
          value={who}
          onChange={(v) => {
            setWho(v);
            setError(undefined);
          }}
          loading={staff.isLoading || freelancers.isLoading}
          placeholder={kind === 'member' ? 'Choose a team member' : 'Choose a freelancer'}
          emptyText={kind === 'freelancer' ? 'No freelancers yet — add one under Money → Freelancers' : 'No matches'}
        />
      </FormField>
      {kind === 'member' ? (
        <FormField label="Role on project">
          <Select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}>
            {Object.values(ProjectMemberRole).map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </FormField>
      ) : (
        <div className="hidden sm:block" />
      )}
      <FormField label="Agreed fee">
        <MoneyInput value={fee} onChange={setFee} placeholder="Optional" />
      </FormField>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="h-9" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" className="h-9" onClick={() => void submit()} disabled={addMember.isPending || addFreelancer.isPending}>
          Add
        </Button>
      </div>
    </div>
  );
}
