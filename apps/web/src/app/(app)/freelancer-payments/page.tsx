'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { formatDate, formatPaise } from '@/lib/formatters';

import {
  type AddPaymentEntryInput,
  type CreateFreelancerPaymentInput,
  type FreelancerPaymentRow,
  type UpdateFreelancerPaymentInput,
  useAddFreelancerPayment,
  useCreateFreelancerPayment,
  useDeleteFreelancerPayment,
  useFreelancerPayments,
  useUpdateFreelancerPayment,
} from '@/features/freelancer-payments/freelancer-payments.hooks';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function FreelancerPaymentsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const list = useFreelancerPayments({ page, limit: 20, ...(statusFilter ? { status: statusFilter } : {}) });
  const create = useCreateFreelancerPayment();

  useEffect(() => { setPage(1); }, [statusFilter]);

  const form = useForm<CreateFreelancerPaymentInput>({
    defaultValues: { freelancerName: '', projectRef: '', agreedTotalPaise: 0, currency: 'INR' },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => { setCreateOpen(false); form.reset(); },
    }),
  );

  const items = list.data?.items ?? [];
  const totalAgreed = items.reduce((s, r) => s + r.agreedTotalPaise, 0);
  const totalPaid = items.reduce((s, r) => s + r.paidPaise, 0);
  const totalPending = items.reduce((s, r) => s + r.pendingPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freelancer Payments"
        description="Track contract agreements and payment history for external collaborators."
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add contract</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New freelancer contract</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="space-y-1">
                  <Label>Freelancer name</Label>
                  <Input {...form.register('freelancerName', { required: true })} placeholder="e.g. Jyoti Makwana" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Email (optional)</Label>
                    <Input type="email" {...form.register('email')} />
                  </div>
                  <div className="space-y-1">
                    <Label>Project / work ref</Label>
                    <Input {...form.register('projectRef', { required: true })} placeholder="e.g. HR Book HRMS" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Agreed total (paise)</Label>
                  <Input type="number" {...form.register('agreedTotalPaise', { required: true, valueAsNumber: true })} placeholder="e.g. 5250000 for ₹52,500" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input {...form.register('notes')} placeholder="Any additional details" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary strip */}
      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Agreed total', value: totalAgreed },
            { label: 'Total paid', value: totalPaid, className: 'text-green-600' },
            { label: 'Pending', value: totalPending, className: 'text-orange-500' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className={`mt-2 text-2xl font-semibold tabular-nums ${s.className ?? ''}`}>
                  {formatPaise(s.value, 'INR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Contract cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded border bg-background px-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {list.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {!list.isLoading && items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No freelancer contracts yet.
            </CardContent>
          </Card>
        )}
        {items.map((row) => (
          <ContractCard key={row._id} row={row} />
        ))}
        {list.data && list.data.meta.totalPages > 1 && (
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            total={list.data.meta.total}
            onPage={setPage}
            className="pt-2"
          />
        )}
      </div>
    </div>
  );
}

function ContractCard({ row }: { row: FreelancerPaymentRow }) {
  const [expanded, setExpanded] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const addPayment = useAddFreelancerPayment();
  const updateContract = useUpdateFreelancerPayment();
  const deleteContract = useDeleteFreelancerPayment();

  const form = useForm<AddPaymentEntryInput>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), amountPaise: 0 },
  });

  const editForm = useForm<UpdateFreelancerPaymentInput>({
    defaultValues: {
      freelancerName: row.freelancerName,
      email: row.email,
      projectRef: row.projectRef,
      agreedTotalPaise: row.agreedTotalPaise,
      status: row.status,
      currency: row.currency,
      notes: row.notes,
    },
  });

  const onPay = form.handleSubmit((values) =>
    addPayment.mutate(
      { id: row._id, body: values },
      { onSuccess: () => { setPayOpen(false); form.reset(); } },
    ),
  );

  const onEditSubmit = editForm.handleSubmit((values) =>
    updateContract.mutate({ id: row._id, body: values }, { onSuccess: () => setEditOpen(false) }),
  );

  const pct = row.agreedTotalPaise > 0 ? (row.paidPaise / row.agreedTotalPaise) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{row.freelancerName}</CardTitle>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[row.status] ?? ''}`}>
                {row.status}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{row.projectRef}</p>
            {row.notes && <p className="mt-1 text-[12px] text-muted-foreground/70">{row.notes}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {row.status === 'ACTIVE' && (
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Log payment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log payment — {row.freelancerName}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={onPay} className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Amount (paise)</Label>
                        <Input type="number" {...form.register('amountPaise', { required: true, valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input type="date" {...form.register('date', { required: true })} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Note</Label>
                      <Input {...form.register('note')} placeholder="e.g. Milestone 1" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={addPayment.isPending}>
                        {addPayment.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit contract — {row.freelancerName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEditSubmit} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Freelancer name</Label>
                  <Input {...editForm.register('freelancerName')} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" {...editForm.register('email')} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Project / work ref</Label>
                <Input {...editForm.register('projectRef')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Agreed total (paise)</Label>
                  <Input type="number" {...editForm.register('agreedTotalPaise', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...editForm.register('status')}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input {...editForm.register('notes')} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateContract.isPending}>
                  {updateContract.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete contract</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Delete the contract with <span className="font-medium text-foreground">{row.freelancerName}</span>? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteContract.isPending}
                onClick={() => deleteContract.mutate(row._id, { onSuccess: () => setConfirmDelete(false) })}
              >
                {deleteContract.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Paid {formatPaise(row.paidPaise, row.currency)}</span>
            <span className="text-orange-500">Pending {formatPaise(row.pendingPaise, row.currency)}</span>
            <span>Total {formatPaise(row.agreedTotalPaise, row.currency)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      {/* Payment history toggle */}
      {row.payments.length > 0 && (
        <CardContent className="pt-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {row.payments.length} payment{row.payments.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1 border-l-2 border-muted pl-3">
              {row.payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{formatDate(p.date)}{p.note ? ` · ${p.note}` : ''}</span>
                  <span className="font-medium tabular-nums">{formatPaise(p.amountPaise, row.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
