// Attendance + Leaves API client + hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  type AdminMarkAttendanceInput,
  type DecideLeaveInput,
  type RequestLeaveInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
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
export function useTeamAttendance(date: string, departmentId?: string) {
  return useQuery({
    queryKey: qk.attendance.team({ date, departmentId }),
    queryFn: () => attendanceApi.team(date, departmentId),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
  });
}
