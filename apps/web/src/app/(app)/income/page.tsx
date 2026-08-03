'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TrendingUp } from 'lucide-react';

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
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDate, formatPaise } from '@/lib/formatters';

import {
  type CreateIncomeInput,
  useCreateIncome,
  useDeleteIncome,
  useIncome,
  useIncomeSummary,
} from '@/features/income/income.hooks';

const CATEGORIES = ['AFFILIATE', 'REFERRAL', 'INTEREST', 'REFUND', 'OTHER'];

const CATEGORY_LABEL: Record<string, string> = {
  AFFILIATE: 'Affiliate', REFERRAL: 'Referral', INTEREST: 'Interest',
  REFUND: 'Refund', OTHER: 'Other',
};

export default function IncomePage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const list = useIncome(catFilter ? { category: catFilter } : undefined);
  const summary = useIncomeSummary();
  const create = useCreateIncome();
  const del = useDeleteIncome();

  const form = useForm<CreateIncomeInput>({
    defaultValues: { title: '', amountPaise: 0, category: 'OTHER', date: new Date().toISOString().slice(0, 10), currency: 'INR' },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => { setOpen(false); form.reset(); },
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description="Track non-client revenue — affiliate payouts, referrals, and other misc income."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add income</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add income</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input {...form.register('title', { required: true })} placeholder="e.g. Hostinger Affiliate Payout" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Amount (paise)</Label>
                    <Input type="number" {...form.register('amountPaise', { required: true, valueAsNumber: true })} placeholder="e.g. 561873 for ₹5,618.73" />
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
                    <Label>Source</Label>
                    <Input {...form.register('source')} placeholder="e.g. Hostinger" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input {...form.register('description')} placeholder="Optional description" />
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

      {/* Summary cards */}
      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            All income
          </CardTitle>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH>Source</TH>
                <TH className="text-right">Amount</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {(list.data?.items ?? []).map((e) => (
                <TR key={e._id}>
                  <TD className="tabular-nums text-muted-foreground">{formatDate(e.date)}</TD>
                  <TD className="font-medium">{e.title}</TD>
                  <TD>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                      {CATEGORY_LABEL[e.category] ?? e.category}
                    </span>
                  </TD>
                  <TD className="text-muted-foreground">{e.source ?? '—'}</TD>
                  <TD className="text-right tabular-nums font-medium">{formatPaise(e.amountPaise, e.currency)}</TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => del.mutate(e._id)}
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </TD>
                </TR>
              ))}
              {!list.isLoading && (list.data?.items ?? []).length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No income recorded yet.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
