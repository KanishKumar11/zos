// My attendance — check in/out + monthly grid + team view (LEAD+).
'use client';

import { useMemo, useState } from 'react';

import { AttendanceStatus, Role } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import {
  useAdminMarkAttendance,
  useCheckIn,
  useCheckOut,
  useMyAttendance,
  useTeamAttendance,
} from '@/features/attendance/attendance.hooks';
import { useTeamList } from '@/features/team/team.hooks';
import { useAuthStore } from '@/store/auth.store';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function AttendancePage() {
  const role = useAuthStore((s) => s.user?.role);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const me = useMyAttendance(month);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const isManager = role && [Role.OWNER, Role.ADMIN, Role.LEAD].includes(role);
  const team = useTeamAttendance(date);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayEntry = me.data?.find((e) => e.date === today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <div className="flex gap-2">
          <Button onClick={() => checkIn.mutate(undefined)} disabled={!!todayEntry?.checkInAt || checkIn.isPending}>
            Check in
          </Button>
          <Button
            variant="secondary"
            onClick={() => checkOut.mutate(undefined)}
            disabled={!todayEntry?.checkInAt || !!todayEntry?.checkOutAt || checkOut.isPending}
          >
            Check out
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>My month</CardTitle>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH>Check-in</TH>
                <TH>Check-out</TH>
                <TH>Worked (h)</TH>
              </TR>
            </THead>
            <TBody>
              {(me.data ?? []).map((e) => (
                <TR key={e._id}>
                  <TD>{e.date}</TD>
                  <TD>
                    <StatusPill status={e.status} />
                  </TD>
                  <TD>{e.checkInAt ? new Date(e.checkInAt).toLocaleTimeString() : '—'}</TD>
                  <TD>{e.checkOutAt ? new Date(e.checkOutAt).toLocaleTimeString() : '—'}</TD>
                  <TD>{(e.workedMinutes / 60).toFixed(2)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Team for {date}</CardTitle>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Status</TH>
                  <TH>Check-in</TH>
                  <TH>Check-out</TH>
                  <TH>Worked (h)</TH>
                </TR>
              </THead>
              <TBody>
                {(team.data ?? []).map((e) => (
                  <TR key={e._id}>
                    <TD>{e.userId}</TD>
                    <TD>
                      <StatusPill status={e.status} />
                    </TD>
                    <TD>{e.checkInAt ? new Date(e.checkInAt).toLocaleTimeString() : '—'}</TD>
                    <TD>{e.checkOutAt ? new Date(e.checkOutAt).toLocaleTimeString() : '—'}</TD>
                    <TD>{(e.workedMinutes / 60).toFixed(2)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(role === Role.OWNER || role === Role.ADMIN) && <AdminMarkCard />}
    </div>
  );
}

function AdminMarkCard() {
  const list = useTeamList({ page: 1, pageSize: 200 });
  const mark = useAdminMarkAttendance();
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [workedMinutes, setWorkedMinutes] = useState<number>(480);
  const [note, setNote] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual mark (Admin)</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) return;
            mark.mutate(
              {
                userId,
                date,
                status,
                workedMinutes,
                ...(note ? { note } : {}),
              } as never,
              { onSuccess: () => setNote('') },
            );
          }}
        >
          <div className="space-y-1">
            <Label>User</Label>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select…</option>
              {(list.data?.items ?? []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
              {Object.values(AttendanceStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Minutes</Label>
            <Input
              type="number"
              value={workedMinutes}
              onChange={(e) => setWorkedMinutes(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1 md:col-span-4">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={!userId || mark.isPending}>
              {mark.isPending ? 'Saving…' : 'Mark'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const cls =
    status === AttendanceStatus.PRESENT
      ? 'bg-emerald-100 text-emerald-800'
      : status === AttendanceStatus.HALF_DAY
        ? 'bg-amber-100 text-amber-800'
        : status === AttendanceStatus.ABSENT
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-100 text-slate-800';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}
