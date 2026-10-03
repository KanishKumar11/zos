// Attendance + Leaves API client + hooks.
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  type AdminMarkAttendanceInput,
  type DecideLeaveInput,
  type RequestLeaveInput,
} from '@agency/shared';

import { api, getErrorMessage, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface AttendanceEntryRow {
  _id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  workedMinutes: number;
  note?: string;
}
export interface LeaveRequestRow {
  _id: string;
  userId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedAt?: string;
  decisionNote?: string;
}
export interface LeaveBalanceRow {
  userId: string;
  year: number;
  annualEntitlement: number;
  annualUsed: number;
  sickEntitlement: number;
  sickUsed: number;
}

export const attendanceApi = {
  checkIn: (note?: string) => unwrap<AttendanceEntryRow>(api.post('/attendance/check-in', { note })),
  checkOut: (note?: string) =>
    unwrap<AttendanceEntryRow>(api.post('/attendance/check-out', { note })),
  me: (month: string) => unwrap<AttendanceEntryRow[]>(api.get('/attendance/me', { params: { month } })),
  team: (date: string, departmentId?: string) =>
    unwrap<AttendanceEntryRow[]>(api.get('/attendance/team', { params: { date, departmentId } })),
  adminMark: (body: AdminMarkAttendanceInput) =>
    unwrap<AttendanceEntryRow>(api.post('/attendance/admin-mark', body)),
};

export const leavesApi = {
  me: () => unwrap<LeaveRequestRow[]>(api.get('/leaves/me')),
  myBalance: () => unwrap<LeaveBalanceRow>(api.get('/leaves/me/balance')),
  pending: () => unwrap<LeaveRequestRow[]>(api.get('/leaves/pending')),
  request: (body: RequestLeaveInput) => unwrap<LeaveRequestRow>(api.post('/leaves', body)),
  decide: (id: string, body: DecideLeaveInput) =>
    unwrap<LeaveRequestRow>(api.patch(`/leaves/${id}/decide`, body)),
  cancel: (id: string) => unwrap<LeaveRequestRow>(api.patch(`/leaves/${id}/cancel`, {})),
};

// Attendance hooks
export function useMyAttendance(month: string) {
  return useQuery({ queryKey: qk.attendance.me(month), queryFn: () => attendanceApi.me(month) });
}
/** OWNER / ADMIN / LEAD only (API @Roles). Pass `enabled: false` for anyone else. */
export function useTeamAttendance(date: string, departmentId?: string, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.attendance.team({ date, departmentId }),
    queryFn: () => attendanceApi.team(date, departmentId),
    enabled: opts.enabled,
  });
}

/**
 * My attendance for the last `months` months (one request per month, sharing the per-month cache),
 * flattened — feeds the attendance calendar heatmap.
 */
export function useMyAttendanceHistory(months: string[]) {
  return useQueries({
    queries: months.map((month) => ({ queryKey: qk.attendance.me(month), queryFn: () => attendanceApi.me(month) })),
    combine: (results) => ({
      entries: results.flatMap((r) => r.data ?? []),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
      error: results.find((r) => r.error)?.error,
      refetch: () => results.forEach((r) => void r.refetch()),
    }),
  });
}
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => attendanceApi.checkIn(note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Checked in');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => attendanceApi.checkOut(note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Checked out');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useAdminMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminMarkAttendanceInput) => attendanceApi.adminMark(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance marked');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

// Leaves hooks
export function useMyLeaves() {
  return useQuery({ queryKey: qk.leaves.me(), queryFn: leavesApi.me });
}
export function useMyLeaveBalance() {
  return useQuery({ queryKey: ['leaves', 'me', 'balance'], queryFn: leavesApi.myBalance });
}
export function usePendingLeaves() {
  return useQuery({ queryKey: qk.leaves.pending(), queryFn: leavesApi.pending });
}
export function useRequestLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestLeaveInput) => leavesApi.request(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave requested');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: DecideLeaveInput }) => leavesApi.decide(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Decision recorded');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leavesApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave cancelled');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
