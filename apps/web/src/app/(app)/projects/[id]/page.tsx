// Project detail.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Pencil } from 'lucide-react';

import { ProjectMemberRole, ProjectStatus, Role, updateProjectSchema } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { useInvoices, useCreateInvoice } from '@/features/invoices/invoices.hooks';
import { useContracts } from '@/features/contracts/contracts.hooks';
import {
  useProject, useSetMemberCost, useUpdateProject, useDeleteProject,
  useAddProjectMember, useRemoveProjectMember,
  useAddMemberPayment, useRemoveMemberPayment,
  useProjectBalance, useAddMilestone, useUpdateMilestone, useRemoveMilestone,
  type MemberPaymentEntry, type MilestoneRow,
} from '@/features/projects/projects.hooks';
import { useTeamList } from '@/features/team/team.hooks';
import { useClients } from '@/features/clients/clients.hooks';
import { useFreelancerPaymentsByProject } from '@/features/freelancer-payments/freelancer-payments.hooks';

type UpdateProjectForm = z.input<typeof updateProjectSchema>;

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const team = useTeamList({ pageSize: 100 });
  const clients = useClients();
  const invoices = useInvoices({ projectId: id });
  const freelancerPayments = useFreelancerPaymentsByProject(isOwner ? id : undefined);
  const contracts = useContracts();
  const createInvoice = useCreateInvoice();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const balance = useProjectBalance(isOwner ? id : undefined);
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const removeMilestone = useRemoveMilestone();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectMemberRole>(ProjectMemberRole.CONTRIBUTOR);
  const [newMemberAmount, setNewMemberAmount] = useState('');

  const [addingMilestone, setAddingMilestone] = useState(false);
  const [msName, setMsName] = useState('');
  const [msAmount, setMsAmount] = useState('');
  const [msDue, setMsDue] = useState('');
  const [msNote, setMsNote] = useState('');

  const [addingInvoice, setAddingInvoice] = useState(false);
  const [invAmount, setInvAmount] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invDesc, setInvDesc] = useState('');

  const editForm = useForm<UpdateProjectForm>({
    resolver: zodResolver(updateProjectSchema) as never,
  });

  useEffect(() => {
    if (project.data) {
      editForm.reset({
        name: project.data.name,
        code: project.data.code,
        description: project.data.description,
        status: project.data.status,
        startDate: project.data.startDate?.slice(0, 10),
        endDate: project.data.endDate?.slice(0, 10),
        brief: project.data.brief,
        clientId: project.data.clientId,
        clientBudgetPaise: project.data.clientBudgetPaise,
        currency: project.data.currency,
      } as never);
    }
  }, [project.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    // Margin is never entered manually — recompute it from the (possibly just-edited) budget
    // minus the team + freelancer costs so the stored figure never drifts from reality.
    const newBudget = (values as { clientBudgetPaise?: number }).clientBudgetPaise ?? p.clientBudgetPaise ?? 0;
    const body = { ...values, agencyMarginPaise: newBudget - totalDevCost };
    updateProject.mutate({ id, body: body as never }, { onSuccess: () => setEditOpen(false) });
  });

  if (project.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!project.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const p = project.data;

  const nameMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));
  const cur = p.currency ?? 'INR';
  const invList = invoices.data ?? [];
  const invoiceMap = new Map(invList.map((i) => [i._id, i]));
  // For milestones sharing the same invoice, only show the invoice card on the last milestone
  // that references it (avoids the same invoice appearing under Advance + M2 + M3).
  const canonicalMsForInvoice = new Map<string, string>();
  (p.milestones ?? []).forEach((ms: any) => {
    if (ms.invoiceId) canonicalMsForInvoice.set(ms.invoiceId, ms._id);
  });
  const invoiceTotal = invList.reduce((s, i) => s + i.totalPaise, 0);
  const clientReceived = invList.reduce((s, i) => s + i.paidPaise, 0);
  const memberBudgeted = p.members.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
  const memberPaid = p.members.reduce((s, m) => s + m.payments.reduce((ps, pay) => ps + pay.amountPaise, 0), 0);
  const freelancerList = freelancerPayments.data ?? [];
  const freelancerAgreed = freelancerList.reduce((s, f) => s + f.agreedTotalPaise, 0);
  const freelancerPaid = freelancerList.reduce((s, f) => s + f.paidPaise, 0);
  // Dev cost and margin are always derived live from actual team + freelancer budgets —
  // never manually entered — so they can't drift out of sync the way a stored figure would.
  const totalDevCost = memberBudgeted + freelancerAgreed;
  const computedMargin = (p.clientBudgetPaise ?? 0) - totalDevCost;

  const relatedContractIds = new Set(
    (invoices.data ?? [])
      .filter((inv) => inv.contractId)
      .map((inv) => inv.contractId)
  );
  const relatedContracts = (contracts.data ?? []).filter((c) => relatedContractIds.has(c._id));
  const clientName = clients.data?.find((c) => c._id === p.clientId)?.name;
  const assignedTeamIds = new Set(p.members.map((m) => m.userId));
  const assignableTeam = (team.data ?? []).filter((u) => !assignedTeamIds.has(u._id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`${p.code} · ${p.status}`}
        action={
          isOwner ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
            </div>
          ) : undefined
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...editForm.register('name')} />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input {...editForm.register('code')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...editForm.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...editForm.register('status')}>
                  {Object.values(ProjectStatus).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Client</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...editForm.register('clientId')}>
                  <option value="">No client (internal)</option>
                  {(clients.data ?? []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" {...editForm.register('startDate')} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" {...editForm.register('endDate')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Client budget (paise)</Label>
              <Input type="number" {...editForm.register('clientBudgetPaise', { valueAsNumber: true })} />
              <p className="text-[11px] text-muted-foreground">
                Agency margin is calculated automatically (budget minus what&apos;s budgeted to the team and freelancers) — currently {formatPaise(computedMargin, cur)}.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Brief</Label>
              <textarea
                className="min-h-24 w-full rounded border bg-background px-3 py-2 text-sm"
                {...editForm.register('brief')}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateProject.isPending}>
                {updateProject.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{p.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteProject.isPending}
              onClick={() => deleteProject.mutate(id, { onSuccess: () => router.push('/projects') })}
            >
              {deleteProject.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {relatedContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Related Contracts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {relatedContracts.map((c) => (
              <a
                key={c._id}
                href={`/contracts/${c._id}`}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:underline"
              >
                {c.name}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

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
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Client</p>
              {p.clientId ? (
                <Link href={`/clients/${p.clientId}`} className="text-lg font-semibold hover:underline">
                  {clientName ?? p.clientId.slice(-6)}
                </Link>
              ) : (
                <p className="text-lg font-semibold text-muted-foreground">No client (internal)</p>
              )}
            </div>
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
              <p className={`text-lg font-semibold ${computedMargin >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatPaise(computedMargin, cur)}
              </p>
            </div>
            {balance.data && (
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">In hand</p>
                <p className={`text-lg font-semibold ${balance.data.inHandPaise >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  {formatPaise(balance.data.inHandPaise, cur)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Milestones</CardTitle>
            <div className="flex gap-2">
              {!addingMilestone && !addingInvoice && (
                <Button size="sm" variant="outline" onClick={() => setAddingMilestone(true)}>+ Add</Button>
              )}
              {!addingInvoice && !addingMilestone && (
                <Button size="sm" variant="outline" onClick={() => {
                  setInvDesc(p.name);
                  setInvAmount(p.clientBudgetPaise ? String(Math.round(p.clientBudgetPaise / 100)) : '');
                  setAddingInvoice(true);
                }}>+ Invoice</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(p.milestones ?? []).length === 0 && !addingMilestone && !addingInvoice && (
              <p className="text-xs text-muted-foreground">No milestones defined. Add milestones to track the payment schedule.</p>
            )}
            {(p.milestones ?? []).map((ms: MilestoneRow) => {
              const isCanonical = ms.invoiceId && canonicalMsForInvoice.get(ms.invoiceId) === ms._id;
              return (
                <MilestoneBlock
                  key={ms._id}
                  milestone={ms}
                  currency={cur}
                  invoice={isCanonical ? (invoiceMap.get(ms.invoiceId!) ?? undefined) : undefined}
                  onUpdate={(body) => updateMilestone.mutate({ id, milestoneId: ms._id, body })}
                  onRemove={() => removeMilestone.mutate({ id, milestoneId: ms._id })}
                />
              );
            })}
            {addingMilestone && (
              <div className="rounded border p-3 space-y-3 bg-muted/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Milestone</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input value={msName} onChange={(e) => setMsName(e.target.value)} className="h-8 text-sm" placeholder="e.g. Advance" autoFocus />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Amount (₹)</label>
                    <Input type="number" min={0} value={msAmount} onChange={(e) => setMsAmount(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Due date</label>
                    <Input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Note (optional)</label>
                  <Input value={msNote} onChange={(e) => setMsNote(e.target.value)} className="h-8 text-sm" placeholder="optional" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={addMilestone.isPending} onClick={() => {
                    const paise = Math.round(parseFloat(msAmount) * 100);
                    if (!msName.trim() || isNaN(paise) || paise < 0) return;
                    addMilestone.mutate({ id, name: msName.trim(), amountPaise: paise, dueDate: msDue || undefined, note: msNote || undefined }, {
                      onSuccess: () => { setAddingMilestone(false); setMsName(''); setMsAmount(''); setMsDue(''); setMsNote(''); },
                    });
                  }}>Add Milestone</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingMilestone(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {addingInvoice && (
              <div className="rounded border p-3 space-y-3 bg-muted/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Invoice</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Issue Date</label>
                    <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Amount (₹)</label>
                    <Input type="number" min={1} value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="h-8 text-sm" placeholder="e.g. 50000" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Input value={invDesc} onChange={(e) => setInvDesc(e.target.value)} className="h-8 text-sm" placeholder="e.g. Website development" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={createInvoice.isPending} onClick={() => {
                    const paise = Math.round(parseFloat(invAmount) * 100);
                    if (!p.clientId || isNaN(paise) || paise <= 0) return;
                    createInvoice.mutate({
                      clientId: p.clientId,
                      projectId: id,
                      issueDate: new Date(invDate),
                      lineItems: [{ description: invDesc || p.name, qty: 1, unitPaise: paise }],
                      currency: p.currency ?? 'INR',
                    }, { onSuccess: () => {
                      setAddingInvoice(false);
                      setInvAmount('');
                      setInvDesc('');
                      setInvDate(new Date().toISOString().slice(0, 10));
                    } });
                  }}>{createInvoice.isPending ? 'Creating…' : 'Create Invoice'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingInvoice(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && balance.data && (
        <Card>
          <CardHeader>
            <CardTitle>Project Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Collected from client</p>
                <p className="text-lg font-semibold text-green-600">{formatPaise(balance.data.collectedPaise, cur)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Paid to team</p>
                <p className="text-lg font-semibold text-amber-600">{formatPaise(balance.data.disbursedPaise, cur)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">In hand</p>
                <p className={`text-lg font-semibold ${balance.data.inHandPaise >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  {formatPaise(balance.data.inHandPaise, cur)}
                </p>
              </div>
            </div>
            {balance.data.memberBalances.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>Member</TH>
                    <TH>Budgeted</TH>
                    <TH>Paid</TH>
                    <TH>Pending</TH>
                  </TR>
                </THead>
                <TBody>
                  {balance.data.memberBalances.map((mb) => (
                    <TR key={mb.userId}>
                      <TD className="font-medium">{mb.name}</TD>
                      <TD>{mb.budgetedPaise > 0 ? formatPaise(mb.budgetedPaise, cur) : '—'}</TD>
                      <TD className="text-green-700">{mb.disbursedPaise > 0 ? formatPaise(mb.disbursedPaise, cur) : '₹0'}</TD>
                      <TD className={mb.pendingPaise > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                        {mb.pendingPaise > 0 ? formatPaise(mb.pendingPaise, cur) : '✓'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
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
                      <span className={`text-xs px-2 py-1 rounded ${fp.status === 'COMPLETED' ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : fp.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Members ({p.members.length})</CardTitle>
          {isOwner && !addingMember && (
            <Button size="sm" variant="outline" onClick={() => setAddingMember(true)}>+ Add member</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isOwner && addingMember && (
            <div className="rounded border p-3 space-y-2 bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add member</p>
              <div className="grid gap-2 sm:grid-cols-4">
                <select
                  value={newMemberUserId}
                  onChange={(e) => setNewMemberUserId(e.target.value)}
                  className="h-8 rounded border bg-background px-2 text-sm sm:col-span-2"
                >
                  <option value="">Select team member…</option>
                  {assignableTeam.map((u) => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as ProjectMemberRole)}
                  className="h-8 rounded border bg-background px-2 text-sm"
                >
                  {Object.values(ProjectMemberRole).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Budgeted (₹, optional)"
                  className="h-8 text-sm"
                  value={newMemberAmount}
                  onChange={(e) => setNewMemberAmount(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!newMemberUserId || addMember.isPending}
                  onClick={() => {
                    const inr = parseFloat(newMemberAmount);
                    addMember.mutate(
                      {
                        id,
                        body: {
                          userId: newMemberUserId,
                          role: newMemberRole,
                          ...(newMemberAmount && !isNaN(inr) ? { amountPaise: Math.round(inr * 100) } : {}),
                        },
                      },
                      {
                        onSuccess: () => {
                          setAddingMember(false);
                          setNewMemberUserId('');
                          setNewMemberAmount('');
                          setNewMemberRole(ProjectMemberRole.CONTRIBUTOR);
                        },
                      },
                    );
                  }}
                >
                  {addMember.isPending ? 'Adding…' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingMember(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Added</TH>
                {isOwner && <TH>Budgeted Pay</TH>}
                {isOwner && <TH>Paid</TH>}
                {isOwner && <TH />}
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
                    onRemove={() => {
                      if (confirm(`Remove ${nameMap.get(m.userId) ?? 'this member'} from the project?`)) {
                        removeMember.mutate({ id, userId: m.userId });
                      }
                    }}
                  />
                );
              })}
              {isOwner && p.members.length > 0 && (
                <TR>
                  <TD colSpan={3} className="text-right text-xs text-muted-foreground">Total</TD>
                  <TD className="font-semibold">{formatPaise(memberBudgeted, cur)}</TD>
                  <TD className="font-semibold text-green-700">{formatPaise(memberPaid, cur)}</TD>
                  <TD />
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
    PAID: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
    PARTIALLY_PAID: 'bg-amber-600/10 text-amber-600',
    UNPAID: 'bg-muted text-muted-foreground',
    OVERDUE: 'bg-destructive/10 text-destructive',
    WRITTEN_OFF: 'bg-muted text-muted-foreground/70',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${variants[status] ?? 'bg-muted text-muted-foreground'}`}>
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
    <button
      type="button"
      className="group inline-flex items-center gap-1.5 rounded px-1 text-left decoration-dashed decoration-muted-foreground/50 underline-offset-4 hover:bg-muted hover:underline"
      onClick={startEdit}
      title="Click to edit budgeted amount"
    >
      {shownPaise > 0
        ? formatPaise(shownPaise, currency)
        : <span className="text-muted-foreground">— click to set</span>}
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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
  onRemove,
}: {
  projectId: string;
  member: { userId: string; role: string; addedAt: string; amountPaise: number; payments: MemberPaymentEntry[] };
  name: string;
  currency: string;
  isOwner: boolean;
  paidTotal: number;
  onRemove: () => void;
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
      {isOwner && (
        <TD>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
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
  const [forPeriod, setForPeriod] = useState('');
  const add = useAddMemberPayment();
  const remove = useRemoveMemberPayment();

  const paidTotal = member.payments.reduce((s, p) => s + p.amountPaise, 0);
  const remaining = (member.amountPaise ?? 0) - paidTotal;

  const save = () => {
    const paise = Math.round(parseFloat(amount) * 100);
    if (isNaN(paise) || paise <= 0) return;
    add.mutate({ id: projectId, userId: member.userId, amountPaise: paise, paidAt: date, note: note || undefined, forPeriod: forPeriod || undefined });
    setAdding(false);
    setAmount('');
    setNote('');
    setForPeriod('');
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
                {(pay as any).forPeriod ? ` (for ${(pay as any).forPeriod})` : ''}{pay.note ? ` · ${pay.note}` : ''}
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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">For period (YYYY-MM)</label>
            <Input placeholder="e.g. 2026-05" value={forPeriod} onChange={(e) => setForPeriod(e.target.value)} className="h-8 w-32 text-sm" />
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

function MilestoneBlock({
  milestone,
  currency,
  invoice,
  onUpdate,
  onRemove,
}: {
  milestone: { _id: string; name: string; amountPaise: number; dueDate?: string; status: string; note: string; invoiceId?: string };
  currency: string;
  invoice?: { _id: string; number: string; status: string; totalPaise: number; paidPaise: number; currency: string; payments: { _id: string; paidAt: string; amountPaise: number; reference?: string; method?: string }[] };
  onUpdate: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-muted text-muted-foreground',
    INVOICED: 'bg-amber-600/10 text-amber-600',
    COLLECTED: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
  };
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{milestone.name}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[milestone.status] ?? statusColors.PENDING}`}>
              {milestone.status}
            </span>
            {milestone.dueDate && (
              <span className="text-xs text-muted-foreground">
                Due {new Date(milestone.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {milestone.note && <p className="text-xs text-muted-foreground mt-0.5">{milestone.note}</p>}
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-sm font-semibold">{formatPaise(milestone.amountPaise, currency)}</span>
          <select
            value={milestone.status}
            onChange={(e) => onUpdate({ status: e.target.value })}
            className="rounded border bg-background px-1.5 py-0.5 text-xs"
          >
            <option value="PENDING">PENDING</option>
            <option value="INVOICED">INVOICED</option>
            <option value="COLLECTED">COLLECTED</option>
          </select>
          <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-red-500" title="Remove">✕</button>
        </div>
      </div>
      {invoice && (
        <div className="border-t pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <a href={`/invoices/${invoice._id}`} className="text-xs font-semibold text-primary hover:underline">{invoice.number}</a>
            <InvoiceStatusBadge status={invoice.status} />
            <span className="text-xs text-muted-foreground">{formatPaise(invoice.totalPaise, invoice.currency)}</span>
            <a href={`/invoices/${invoice._id}`} className="text-xs text-primary hover:underline ml-auto">View →</a>
          </div>
          {invoice.payments.length > 0 ? (
            <div className="space-y-0.5 pl-1">
              {invoice.payments.map((pay) => (
                <div key={pay._id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(pay.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {pay.reference ? ` · ${pay.reference}` : ''}
                    {pay.method ? ` · ${pay.method}` : ''}
                  </span>
                  <span className="font-medium text-green-700">+{formatPaise(pay.amountPaise, invoice.currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pl-1">No payments received yet</p>
          )}
        </div>
      )}
    </div>
  );
}
