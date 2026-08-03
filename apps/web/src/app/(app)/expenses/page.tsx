'use client';

import { useEffect, useState } from 'react';
import { type Control, type UseFormRegister, useFieldArray, useForm } from 'react-hook-form';
import { TrendingDown } from 'lucide-react';

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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FileUploader } from '@/components/file-uploader';
import { formatDate, formatPaise } from '@/lib/formatters';
import { getDownloadUrl } from '@/lib/upload';

import {
  type CreateExpenseInput,
  type ExpenseContribution,
  type ExpenseRow,
  type UpdateExpenseInput,
  netExpensePaise,
  useCreateExpense,
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useUpdateExpense,
} from '@/features/expenses/expenses.hooks';
import { useTeamList } from '@/features/team/team.hooks';

const CATEGORIES = [
  'TOOLS', 'SOFTWARE', 'INFRASTRUCTURE', 'MARKETING', 'OPERATIONS', 'PAYROLL', 'FREELANCER', 'OTHER',
];

const CATEGORY_LABEL: Record<string, string> = {
  TOOLS: 'Tools', SOFTWARE: 'Software', INFRASTRUCTURE: 'Infrastructure',
  MARKETING: 'Marketing', OPERATIONS: 'Operations', PAYROLL: 'Payroll',
  FREELANCER: 'Freelancer', OTHER: 'Other',
};

const PAGE_SIZE = 20;

export default function ExpensesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [viewing, setViewing] = useState<ExpenseRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseRow | null>(null);
  const [catFilter, setCatFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [page, setPage] = useState(1);

  const listParams = {
    page,
    limit: PAGE_SIZE,
    ...(catFilter ? { category: catFilter } : {}),
    ...(fromFilter ? { from: fromFilter } : {}),
    ...(toFilter ? { to: toFilter } : {}),
  };
  const list = useExpenses(listParams);
  const summary = useExpenseSummary(fromFilter || undefined, toFilter || undefined);
  const team = useTeamList({});
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const del = useDeleteExpense();

  const nameMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [catFilter, fromFilter, toFilter]);

  const form = useForm<CreateExpenseInput>({
    defaultValues: { title: '', amountPaise: 0, category: 'OTHER', date: new Date().toISOString().slice(0, 10), currency: 'INR' },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => { setOpen(false); form.reset(); },
    }),
  );

  const editForm = useForm<UpdateExpenseInput>();

  useEffect(() => {
    if (editing) {
      editForm.reset({
        title: editing.title,
        description: editing.description,
        amountPaise: editing.amountPaise,
        category: editing.category,
        date: editing.date.slice(0, 10),
        vendor: editing.vendor,
        receiptRef: editing.receiptRef,
        currency: editing.currency,
      });
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editing) return;
    update.mutate({ id: editing._id, body: values }, { onSuccess: () => setEditing(null) });
  });

  const meta = list.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track business costs — tools, infrastructure, marketing, and more."
        action={<Button onClick={() => setOpen(true)}>Add expense</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input {...form.register('title', { required: true })} placeholder="e.g. Hetzner VPS" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (paise)</Label>
                <Input type="number" {...form.register('amountPaise', { required: true, valueAsNumber: true })} placeholder="e.g. 100000 for ₹1,000" />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...form.register('date', { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select className="w-full rounded border bg-background px-3 py-2 text-sm" {...form.register('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Input {...form.register('vendor')} placeholder="e.g. AWS" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input {...form.register('description')} placeholder="Optional description" />
            </div>
            <div className="space-y-1">
              <Label>Receipt</Label>
              <div className="flex items-center gap-2">
                <FileUploader
                  prefix="expenses/receipts"
                  accept="application/pdf,image/*"
                  label={form.watch('receiptRef') ? 'Replace receipt' : 'Upload receipt'}
                  onUploaded={(res) => form.setValue('receiptRef', res.key)}
                />
                {form.watch('receiptRef') && (
                  <span className="text-xs text-muted-foreground">Attached ✓</span>
                )}
              </div>
            </div>
            <ContributionsEditor control={form.control} register={form.register} teamOptions={team.data ?? []} />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary cards */}
      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Total {fromFilter || toFilter ? '(filtered)' : ''}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPaise(summary.data.grandTotalPaise, 'INR')}</p>
            </CardContent>
          </Card>
          {summary.data.byCategory.map((c) => (
            <Card key={c._id}>
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{CATEGORY_LABEL[c._id] ?? c._id}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{formatPaise(c.totalPaise, 'INR')}</p>
                <p className="text-[11px] text-muted-foreground">{c.count} {c.count === 1 ? 'entry' : 'entries'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter + table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            All expenses
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="h-8 w-auto text-sm"
              title="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="h-8 w-auto text-sm"
              title="To date"
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-sm"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            {(fromFilter || toFilter || catFilter) && (
              <button
                type="button"
                onClick={() => { setFromFilter(''); setToFilter(''); setCatFilter(''); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH>Vendor</TH>
                <TH>Added by</TH>
                <TH className="text-right">Amount</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {(list.data?.items ?? []).map((e) => (
                <TR key={e._id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewing(e)}>
                  <TD className="tabular-nums text-muted-foreground">{formatDate(e.date)}</TD>
                  <TD className="font-medium">{e.title}</TD>
                  <TD>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                      {CATEGORY_LABEL[e.category] ?? e.category}
                    </span>
                  </TD>
                  <TD className="text-muted-foreground">{e.vendor ?? '—'}</TD>
                  <TD className="text-muted-foreground">{e.addedBy ? nameMap.get(e.addedBy) ?? '—' : '—'}</TD>
                  <TD className="text-right tabular-nums font-medium">
                    {formatPaise(e.amountPaise, e.currency)}
                    {e.contributions.length > 0 && (
                      <div className="text-[11px] font-normal text-muted-foreground">
                        net {formatPaise(netExpensePaise(e), e.currency)}
                      </div>
                    )}
                  </TD>
                  <TD onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(e)}
                        className="text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
              {!list.isLoading && (list.data?.items ?? []).length === 0 && (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No expenses match these filters.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                Page {meta.page} of {meta.totalPages} · {meta.total} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input {...editForm.register('title')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (paise)</Label>
                <Input type="number" {...editForm.register('amountPaise', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...editForm.register('date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select className="w-full rounded border bg-background px-3 py-2 text-sm" {...editForm.register('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Input {...editForm.register('vendor')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input {...editForm.register('description')} />
            </div>
            <div className="space-y-1">
              <Label>Receipt</Label>
              <div className="flex items-center gap-2">
                <FileUploader
                  prefix="expenses/receipts"
                  accept="application/pdf,image/*"
                  label={editForm.watch('receiptRef') ? 'Replace receipt' : 'Upload receipt'}
                  onUploaded={(res) => editForm.setValue('receiptRef', res.key)}
                />
                {editForm.watch('receiptRef') && (
                  <span className="text-xs text-muted-foreground">Attached ✓</span>
                )}
              </div>
            </div>
            <ContributionsEditor control={editForm.control} register={editForm.register} teamOptions={team.data ?? []} />
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label={viewing.contributions.length > 0 ? 'Gross amount' : 'Amount'}
                  value={formatPaise(viewing.amountPaise, viewing.currency)}
                />
                <DetailField label="Date" value={formatDate(viewing.date)} />
                <DetailField label="Category" value={CATEGORY_LABEL[viewing.category] ?? viewing.category} />
                <DetailField label="Vendor" value={viewing.vendor ?? '—'} />
                <DetailField label="Added by" value={viewing.addedBy ? nameMap.get(viewing.addedBy) ?? '—' : '—'} />
                <DetailField label="Logged" value={formatDate(viewing.createdAt)} />
              </div>
              {viewing.contributions.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Team contributions</p>
                  <div className="mt-1 space-y-1">
                    {viewing.contributions.map((c, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>
                          {nameMap.get(c.userId) ?? c.userId}
                          {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
                        </span>
                        <span className="font-medium text-emerald-600">−{formatPaise(c.amountPaise, viewing.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 text-sm font-semibold">
                      <span>Net agency cost</span>
                      <span>{formatPaise(netExpensePaise(viewing), viewing.currency)}</span>
                    </div>
                  </div>
                </div>
              )}
              {viewing.description && <DetailField label="Notes" value={viewing.description} />}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
                {viewing.receiptRef ? (
                  <button
                    type="button"
                    className="mt-1 text-sm text-primary underline"
                    onClick={async () => {
                      const url = await getDownloadUrl(viewing.receiptRef!);
                      window.open(url, '_blank', 'noopener');
                    }}
                  >
                    View receipt
                  </button>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No receipt attached.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(viewing);
                setViewing(null);
              }}
            >
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{confirmDelete?.title}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() =>
                confirmDelete && del.mutate(confirmDelete._id, { onSuccess: () => setConfirmDelete(null) })
              }
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

interface ContributionsFormShape {
  contributions?: ExpenseContribution[];
}

function ContributionsEditor<T extends ContributionsFormShape>({
  control,
  register,
  teamOptions,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  teamOptions: { _id: string; name: string }[];
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'contributions' as never });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Team contributions</Label>
        <button
          type="button"
          onClick={() => append({ userId: '', amountPaise: 0, note: '' } as never)}
          className="text-xs text-primary hover:underline"
        >
          + Add contributor
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Record a team member covering part of this cost via a payroll deduction instead of cash.
      </p>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">No contributions.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2">
              <select
                className="h-8 rounded border bg-background px-2 text-xs"
                {...register(`contributions.${i}.userId` as never)}
              >
                <option value="">Select member…</option>
                {teamOptions.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Paise"
                className="h-8 text-xs"
                {...register(`contributions.${i}.amountPaise` as never, { valueAsNumber: true })}
              />
              <Input
                placeholder="Note (optional)"
                className="h-8 text-xs"
                {...register(`contributions.${i}.note` as never)}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
