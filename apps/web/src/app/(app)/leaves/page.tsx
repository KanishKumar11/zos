// Leaves page — apply, list mine, manager queue.
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { LeaveStatus, LeaveType, Role, requestLeaveSchema, type RequestLeaveInput } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import {
  useCancelLeave,
  useDecideLeave,
  useMyLeaveBalance,
  useMyLeaves,
  usePendingLeaves,
  useRequestLeave,
} from '@/features/attendance/attendance.hooks';
import { useAuthStore } from '@/store/auth.store';

export default function LeavesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isManager = role && [Role.OWNER, Role.ADMIN, Role.LEAD].includes(role);
  const balance = useMyLeaveBalance();
  const mine = useMyLeaves();
  const pending = usePendingLeaves();
  const request = useRequestLeave();
  const decide = useDecideLeave();
  const cancel = useCancelLeave();

  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<RequestLeaveInput>({
    resolver: zodResolver(requestLeaveSchema),
    defaultValues: { type: LeaveType.ANNUAL, startDate: today, endDate: today, reason: '' },
  });

  const onSubmit = form.handleSubmit((values) =>
    request.mutate(values, { onSuccess: () => form.reset({ ...values, reason: '' }) }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leaves</h1>

      {balance.data && (
        <Card>
          <CardHeader>
            <CardTitle>My balance ({balance.data.year})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <BalanceRow
              label="Annual"
              entitlement={balance.data.annualEntitlement}
              used={balance.data.annualUsed}
            />
            <BalanceRow
              label="Sick"
              entitlement={balance.data.sickEntitlement}
              used={balance.data.sickUsed}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Apply</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select {...form.register('type')}>
                {Object.values(LeaveType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" {...form.register('startDate')} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" {...form.register('endDate')} />
            </div>
            <div className="space-y-1 md:col-span-4">
              <Label>Reason</Label>
              <Input {...form.register('reason')} placeholder="Brief reason" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" disabled={request.isPending}>
                {request.isPending ? 'Submitting…' : 'Request leave'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveTable
            rows={mine.data ?? []}
            cancellable
            onCancel={(id) => cancel.mutate(id)}
          />
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveTable
              rows={pending.data ?? []}
              decidable
              onDecide={(id, approve) =>
                decide.mutate({ id, body: { approve } })
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BalanceRow({ label, entitlement, used }: { label: string; entitlement: number; used: number }) {
  const remaining = entitlement - used;
  return (
    <div className="rounded border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Used {used} of {entitlement} · {remaining} remaining
      </p>
    </div>
  );
}

interface LeaveTableProps {
  rows: Array<{
    _id: string;
    userId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    days: number;
    status: LeaveStatus;
    reason: string;
  }>;
  cancellable?: boolean;
  decidable?: boolean;
  onCancel?: (id: string) => void;
  onDecide?: (id: string, approve: boolean) => void;
}

function LeaveTable({ rows, cancellable, decidable, onCancel, onDecide }: LeaveTableProps) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  return (
    <Table>
      <THead>
        <TR>
          {decidable && <TH>User</TH>}
          <TH>Type</TH>
          <TH>From</TH>
          <TH>To</TH>
          <TH>Days</TH>
          <TH>Status</TH>
          <TH>Reason</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r._id}>
            {decidable && <TD>{r.userId}</TD>}
            <TD>{r.type}</TD>
            <TD>{r.startDate.slice(0, 10)}</TD>
            <TD>{r.endDate.slice(0, 10)}</TD>
            <TD>{r.days}</TD>
            <TD>{r.status}</TD>
            <TD className="max-w-xs truncate">{r.reason}</TD>
            <TD>
              {cancellable && r.status === LeaveStatus.PENDING && (
                <Button size="sm" variant="ghost" onClick={() => onCancel?.(r._id)}>
                  Cancel
                </Button>
              )}
              {decidable && r.status === LeaveStatus.PENDING && (
                <span className="flex gap-1">
                  <Button size="sm" onClick={() => onDecide?.(r._id, true)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDecide?.(r._id, false)}>
                    Reject
                  </Button>
                </span>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
