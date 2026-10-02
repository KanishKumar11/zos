// Attendance — check in/out, my month, holidays (everyone), team view (LEAD+), manual marking (OWNER/ADMIN).
'use client';

import { CalendarDays, Clock } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AttendanceStatus, Role } from '@agency/shared';

import { thisMonthLocal, todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  useAdminMarkAttendance,
  useCheckIn,
  useCheckOut,
  useMyAttendance,
  useTeamAttendance,
  type AttendanceEntryRow,
} from '@/features/attendance/attendance.hooks';
import { useHolidays } from '@/features/settings/settings.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  HALF_DAY: 'Half day',
  LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
};

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—');
const hours = (min: number) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : '—');
/** 'YYYY-MM-DD' (holiday dates are stored at UTC midnight) → a local Date for display. */
const asLocal = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

export default function AttendancePage() {
  const role = useAuthStore((s) => s.user?.role);
  const [month, setMonth] = useState(thisMonthLocal());
  const [date, setDate] = useState(todayLocal());
  const me = useMyAttendance(month);
  const today = useMyAttendance(thisMonthLocal());
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const isManager = !!role && [Role.OWNER, Role.ADMIN, Role.LEAD].includes(role);

  const todayKey = todayLocal();
  const todayEntry = today.data?.find((e) => e.date === todayKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Check in and out, see your month, and the holiday calendar."
        action={
          <>
            <Button size="sm" onClick={() => checkIn.mutate(undefined)} disabled={!!todayEntry?.checkInAt || checkIn.isPending}>
              {todayEntry?.checkInAt ? `Checked in ${time(todayEntry.checkInAt)}` : checkIn.isPending ? 'Checking in…' : 'Check in'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkOut.mutate(undefined)}
              disabled={!todayEntry?.checkInAt || !!todayEntry?.checkOutAt || checkOut.isPending}
            >
              {todayEntry?.checkOutAt ? `Checked out ${time(todayEntry.checkOutAt)}` : 'Check out'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>My month</CardTitle>
            <Input type="month" value={month} max={thisMonthLocal()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
          </CardHeader>
          <CardContent>
            {me.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : me.isError ? (
              <ErrorState error={me.error} onRetry={() => me.refetch()} className="py-6" />
            ) : (me.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No attendance recorded for this month.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>In</TH>
                    <TH>Out</TH>
                    <TH className="text-right">Worked</TH>
                  </TR>
                </THead>
                <TBody>
                  {(me.data ?? []).map((e) => (
                    <TR key={e._id}>
                      <TD className="whitespace-nowrap">{formatDate(asLocal(e.date), { weekday: 'short', day: 'numeric', month: 'short' })}</TD>
                      <TD>
                        <StatusPill status={e.status} />
                      </TD>
                      <TD>{time(e.checkInAt)}</TD>
                      <TD>{time(e.checkOutAt)}</TD>
                      <TD className="text-right tabular-nums">{hours(e.workedMinutes)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <HolidaysCard canManage={role === Role.OWNER || role === Role.ADMIN} />
      </div>

      {isManager && <TeamDayCard date={date} onDate={setDate} />}

      {(role === Role.OWNER || role === Role.ADMIN) && <AdminMarkCard />}
    </div>
  );
}

/** Read-only holiday calendar for everyone. */
function HolidaysCard({ canManage }: { canManage: boolean }) {
  const year = new Date().getFullYear();
  const holidays = useHolidays(year);
  const today = todayLocal();
  const rows = holidays.data ?? [];
  const upcoming = rows.filter((h) => h.date.slice(0, 10) >= today);
  const past = rows.length - upcoming.length;

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Holidays {year}
        </CardTitle>
        {canManage && (
          <Link href="/settings/holidays" className="text-xs text-primary hover:underline">
            Manage
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {holidays.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : holidays.isError ? (
          <ErrorState error={holidays.error} onRetry={() => holidays.refetch()} className="py-4" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays announced for {year} yet.</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No more holidays this year.</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {upcoming.map((h) => (
              <li key={h._id} className="flex items-start gap-3">
                <div className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDate(asLocal(h.date), { day: 'numeric', month: 'short' })}
                  <span className="block">{asLocal(h.date).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    {h.name} {h.optional && <Badge variant="muted" className="ml-1">Optional</Badge>}
                  </p>
                  {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {past > 0 && upcoming.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {past} earlier holiday{past === 1 ? '' : 's'} this year.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TeamDayCard({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const team = useTeamAttendance(date);
  const staff = useStaffDirectory();
  const names = useMemo(() => new Map((staff.data ?? []).map((u) => [u._id, u.name])), [staff.data]);
  const rows: AttendanceEntryRow[] = team.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Team on {formatDate(asLocal(date), { weekday: 'short', day: 'numeric', month: 'short' })}</CardTitle>
        <Input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && onDate(e.target.value)} className="w-44" />
      </CardHeader>
      <CardContent>
        {team.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : team.isError ? (
          <ErrorState error={team.error} onRetry={() => team.refetch()} className="py-6" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-5 w-5" />
            Nobody has checked in or been marked for this day.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Person</TH>
                <TH>Status</TH>
                <TH>In</TH>
                <TH>Out</TH>
                <TH className="text-right">Worked</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((e) => (
                <TR key={e._id}>
                  <TD>
                    <Link href={`/team/${e.userId}`} className="font-medium hover:underline">
                      {names.get(e.userId) ?? (staff.isLoading ? '…' : 'Former team member')}
                    </Link>
                  </TD>
                  <TD>
                    <StatusPill status={e.status} />
                  </TD>
                  <TD>{time(e.checkInAt)}</TD>
                  <TD>{time(e.checkOutAt)}</TD>
                  <TD className="text-right tabular-nums">{hours(e.workedMinutes)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AdminMarkCard() {
  const staff = useStaffDirectory();
  const mark = useAdminMarkAttendance();
  const [userId, setUserId] = useState<string>();
  const [date, setDate] = useState(todayLocal());
  const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.ABSENT);
  const [hoursWorked, setHoursWorked] = useState('8');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const worked = status === AttendanceStatus.PRESENT || status === AttendanceStatus.HALF_DAY;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!userId) e.userId = 'Pick a person';
    if (!date) e.date = 'Pick a date';
    const h = hoursWorked === '' ? 0 : Number(hoursWorked);
    if (worked && (Number.isNaN(h) || h < 0 || h > 24)) e.hours = 'Hours between 0 and 24';
    setErrors(e);
    if (Object.keys(e).length) return;
    mark.mutate(
      {
        userId: userId!,
        date: date as unknown as Date,
        status,
        workedMinutes: worked ? Math.round(h * 60) : 0,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: () => setNote('') },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark attendance</CardTitle>
        <p className="text-sm text-muted-foreground">
          Payroll only treats days marked absent (and half days) as unpaid, unless “treat missing attendance as absent” is on in settings.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 md:grid-cols-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField label="Person" error={errors.userId}>
            <Combobox
              options={(staff.data ?? []).map((u) => ({ value: u._id, label: u.name, description: u.email }))}
              value={userId}
              onChange={(v) => {
                setUserId(v);
                setErrors((x) => ({ ...x, userId: undefined }));
              }}
              loading={staff.isLoading}
              placeholder="Select a person"
              searchPlaceholder="Search people…"
              invalid={!!errors.userId}
            />
          </FormField>
          <FormField label="Date" error={errors.date}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
              {Object.values(AttendanceStatus).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Hours worked" error={errors.hours} hint={worked ? undefined : 'Not needed for this status'}>
            <Input type="number" min={0} max={24} step={0.5} value={hoursWorked} disabled={!worked} onChange={(e) => setHoursWorked(e.target.value)} />
          </FormField>
          <FormField label="Note" hint="Optional" className="md:col-span-3">
            <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={mark.isPending}>
              {mark.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const variant =
    status === AttendanceStatus.PRESENT
      ? 'success'
      : status === AttendanceStatus.HALF_DAY
        ? 'warning'
        : status === AttendanceStatus.ABSENT
          ? 'danger'
          : 'muted';
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}
