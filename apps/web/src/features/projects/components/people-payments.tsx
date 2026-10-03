// People & payments (OWNER) — everyone on a project as an avatar row: agreed fee (click to edit),
// a jar filling as it's paid, and a Pay button that opens the log-payment sheet prefilled with what's
// still owed. Expand a row for the payments behind the number. `compact` is the overview snapshot.
'use client';

import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Send, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PAYOUT_METHOD_LABEL, PayeeType, ProjectMemberRole, Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Avatar, FillJar, Price, SegmentBar, Tile, useCanSeePrices } from '@/components/viz';
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

export function PeoplePayments({ project, compact = false, onManage }: { project: ProjectRow; compact?: boolean; onManage?: () => void }) {
  const balances = useProjectPayoutBalances(project._id);
  const ledger = usePayouts({ projectId: project._id, pageSize: 500 }, { enabled: !compact });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState<'member' | 'freelancer' | null>(null);
  const cur = project.currency ?? 'INR';

  const all = balances.data ?? [];
  // Waiting-to-be-paid first, then by agreed fee — the compact snapshot shows who needs money.
  const rows = compact ? [...all].sort((a, b) => b.pendingPaise - a.pendingPaise || b.agreedPaise - a.agreedPaise).slice(0, 4) : all;
  const totals = all.reduce(
    (t, r) => ({ agreed: t.agreed + r.agreedPaise, paid: t.paid + r.paidPaise, pending: t.pending + r.pendingPaise }),
    { agreed: 0, paid: 0, pending: 0 },
  );
  const roleOf = useMemo(() => new Map(project.members.map((m) => [m.userId, m.role])), [project.members]);
  const historyFor = (r: BalanceRow) =>
    (ledger.data?.items ?? []).filter((p) =>
      r.payeeType === PayeeType.MEMBER ? p.userId === r.payeeId : p.freelancerId === r.payeeId,
    );

  return (
    <Tile
      span={12}
      title="People & payments"
      action={
        <div className="flex flex-wrap gap-2">
          {compact ? (
            onManage && (
              <Button variant="ghost" size="sm" onClick={onManage}>
                Manage people
              </Button>
            )
          ) : (
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
          )}
          <Button size="sm" variant={compact ? 'outline' : 'default'} onClick={() => openLogPayment({ projectId: project._id })}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
          </Button>
        </div>
      }
    >
      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <Figure label="Agreed">
            <Price paise={totals.agreed} currency={cur} />
          </Figure>
          <Figure label="Paid">
            <Price paise={totals.paid} currency={cur} />
          </Figure>
          <Figure label="Still to pay" tone={totals.pending > 0 ? 'warn' : undefined}>
            {totals.pending > 0 ? <Price paise={totals.pending} currency={cur} /> : 'Nothing'}
          </Figure>
          <SegmentBar
            className="min-w-[180px] flex-1"
            height="h-2.5"
            showLabels={false}
            segments={[
              { value: Math.min(totals.paid, totals.agreed || totals.paid), color: 'hsl(var(--success))', label: 'Paid' },
              { value: totals.pending, color: 'hsl(var(--warning))', label: 'Still to pay' },
            ]}
          />
        </div>
      )}

      {adding && <AddPersonRow project={project} kind={adding} onDone={() => setAdding(null)} />}

      {balances.isLoading ? (
        <TableSkeleton rows={3} columns={4} />
      ) : balances.isError ? (
        <ErrorState error={balances.error} onRetry={() => balances.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          illustration="people"
          title="Nobody on this project yet"
          description="Add team members or freelancers with their agreed fee, then log payments against it."
          action={
            compact ? (
              onManage && (
                <Button size="sm" variant="outline" onClick={onManage}>
                  Add people
                </Button>
              )
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding('member')}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add team member
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => {
            const key = `${r.payeeType}:${r.payeeId}`;
            const isOpen = expanded === key;
            const history = isOpen ? historyFor(r) : [];
            const removed =
              r.payeeType === PayeeType.MEMBER
                ? !roleOf.has(r.payeeId)
                : !(project.freelancers ?? []).some((f) => f.freelancerId === r.payeeId);
            const over = r.agreedPaise > 0 && r.paidPaise > r.agreedPaise;
            const settled = r.agreedPaise > 0 && !over && r.pendingPaise === 0;
            return (
              <li key={key} className={cn('rounded-xl border px-3 py-2.5', removed && 'opacity-70')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {!compact && (
                    <button
                      type="button"
                      aria-label={isOpen ? 'Hide payments' : 'Show payments'}
                      aria-expanded={isOpen}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      disabled={r.payoutCount === 0}
                      onClick={() => setExpanded(isOpen ? null : key)}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  )}
                  <Avatar id={r.payeeId} name={r.payeeName} />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={r.payeeType === PayeeType.MEMBER ? `/team/${r.payeeId}` : `/freelancers/${r.payeeId}`}
                        className="font-semibold hover:underline"
                      >
                        {r.payeeName}
                      </Link>
                      {r.payeeType === PayeeType.FREELANCER ? (
                        <Badge variant="info">Freelancer</Badge>
                      ) : (
                        roleOf.get(r.payeeId) && <span className="text-xs text-muted-foreground">· {roleLabel(roleOf.get(r.payeeId)!)}</span>
                      )}
                      {removed && <Badge variant="outline">Removed from project</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      {removed ? (
                        <span>Fee no longer tracked</span>
                      ) : compact ? (
                        r.agreedPaise > 0 ? (
                          <span>
                            <Price paise={r.agreedPaise} currency={cur} /> agreed
                          </span>
                        ) : (
                          <span>No fee set</span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <AgreedFeeCell project={project} row={r} /> agreed
                        </span>
                      )}
                      <span>
                        · <Price paise={r.paidPaise} currency={cur} /> paid
                      </span>
                      <span>
                        ·{' '}
                        {r.payoutCount === 0
                          ? 'no payments yet'
                          : `${r.payoutCount} payment${r.payoutCount === 1 ? '' : 's'}, last ${formatDate(r.lastPaidAt!)}`}
                      </span>
                    </div>
                  </div>
                  <FillJar
                    value={r.paidPaise}
                    max={r.agreedPaise}
                    label={r.agreedPaise > 0 ? `${Math.round((r.paidPaise / r.agreedPaise) * 100)}% of agreed fee paid` : 'No agreed fee'}
                  />
                  <div className="flex items-center gap-1.5">
                    {over ? (
                      <Badge variant="warning">
                        <Price paise={r.paidPaise - r.agreedPaise} currency={cur} compact /> over
                      </Badge>
                    ) : settled ? (
                      <Badge variant="success">Settled</Badge>
                    ) : null}
                    {!removed && (
                      <Button
                        size="sm"
                        variant={r.pendingPaise > 0 ? 'default' : 'outline'}
                        className="h-8"
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
                        {r.pendingPaise > 0 && <Price paise={r.pendingPaise} currency={cur} compact className="ml-1" />}
                      </Button>
                    )}
                    {!compact && !removed && <RowMenu project={project} row={r} />}
                  </div>
                </div>
                {isOpen && (
                  <ul className="mt-2.5 divide-y rounded-lg border bg-background">
                    {ledger.isLoading ? (
                      <li className="px-3 py-2 text-[13px] text-muted-foreground">Loading payments…</li>
                    ) : ledger.isError ? (
                      <li className="px-3 py-2 text-[13px] text-destructive">Couldn&apos;t load the payments. Try again in a moment.</li>
                    ) : history.length === 0 ? (
                      <li className="px-3 py-2 text-[13px] text-muted-foreground">No payments found in the ledger.</li>
                    ) : (
                      history.map((p) => (
                        <li key={p._id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                          <span className="w-24 shrink-0 text-muted-foreground">{formatDate(p.paidAt)}</span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {PAYOUT_METHOD_LABEL[p.method]}
                            {p.reference ? ` · ${p.reference}` : ''}
                            {p.note ? ` · ${p.note}` : ''}
                          </span>
                          <Price paise={p.amountPaise} currency={p.currency} className="font-medium" />
                          <button
                            type="button"
                            aria-label="Edit payment"
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            onClick={() => openLogPayment({}, p._id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
          {compact && all.length > rows.length && onManage && (
            <li>
              <button type="button" onClick={onManage} className="w-full rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                {all.length - rows.length} more {all.length - rows.length === 1 ? 'person' : 'people'} on this project
              </button>
            </li>
          )}
        </ul>
      )}
    </Tile>
  );
}

function Figure({ label, tone, children }: { label: string; tone?: 'warn'; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-figures text-lg font-semibold', tone === 'warn' && 'text-warning')}>{children}</p>
    </div>
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
        className="group -mx-1 inline-flex items-center gap-1 rounded px-1 tabular-nums hover:bg-accent"
        title="Edit agreed fee"
      >
        {row.agreedPaise > 0 ? <Price paise={row.agreedPaise} currency={project.currency ?? 'INR'} /> : <span className="text-foreground underline decoration-dotted">Set fee</span>}
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }
  return (
    <div className="flex w-[200px] items-center gap-1">
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
  const canSee = useCanSeePrices();

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${row.payeeName} from ${project.name}?`,
      description:
        row.payoutCount > 0
          ? `Their ${row.payoutCount} payment${row.payoutCount === 1 ? '' : 's'}${canSee ? ` (${formatPaise(row.paidPaise, project.currency ?? 'INR')})` : ''} stay in the ledger and still count towards project cost.`
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
    <div className="mb-3 grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_160px_180px_auto] sm:items-end">
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
