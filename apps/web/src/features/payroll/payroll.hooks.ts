// Payroll API + hooks. Run management is OWNER+ADMIN. Payslips: own (member) or run-scoped (admin).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  PayrollSkipReason,
  PayrollStatus,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
  type PayslipAdjustmentInput,
} from '@agency/shared';

import { api, getErrorMessage, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface PayrollRunRow {
  _id: string;
  month: string;
  status: PayrollStatus;
  totalNetPaise: number;
  employeeCount: number;
  finalizedAt?: string;
  paidAt?: string;
  reopenedAt?: string;
  computedAt?: string;
  createdAt?: string;
  notes?: string;
  skipped?: { userId: string; name: string; reason: PayrollSkipReason }[];
}
export interface PayslipRow {
  _id: string;
  runId: string;
  month: string;
  userId: string;
  /** Added by the run payslips endpoint. */
  userName?: string;
  userEmail?: string;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  workingDays: number;
  elapsedWorkingDays?: number;
  presentDays: number;
  lopDays: number;
  absentDays?: number;
  leaveDays?: number;
  unmarkedDays?: number;
  notJoinedDays?: number;
  currency: string;
  pdfKey?: string;
  breakdown: {
    baseAmount: number;
    hra: number;
    specialAllowance: number;
    lopDeduction: number;
    providentFundEmployee: number;
    professionalTax: number;
    tdsMonthly: number;
    lateDeduction: number;
    bonusPaise: number;
    manualDeductionPaise: number;
  };
  adjustments: { kind: 'BONUS' | 'DEDUCTION'; reason: string; amountPaise: number }[];
  projectPayments?: {
    projectId: string;
    projectName: string;
    amountPaise: number;
    paidAt: string;
    note: string;
  }[];
}
export interface BankExportRow {
  payslipId: string;
  userId: string;
  name: string;
  email?: string;
  accountHolderName?: string;
  accountNumberLast4?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  netPaise: number;
  currency: string;
}

/** "2026-09" → "September 2026". */
export const monthTitle = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

/** Runs auto-created from project payments (removed feature) carry this note. */
export const isLegacyProjectRun = (run: Pick<PayrollRunRow, 'notes'>): boolean =>
  /^Project-based payouts for \d{4}-\d{2}/.test(run.notes ?? '');

export const payrollApi = {
  runs: () => unwrap<PayrollRunRow[]>(api.get('/payroll/runs')),
  run: (id: string) => unwrap<PayrollRunRow>(api.get(`/payroll/runs/${id}`)),
  payslips: (runId: string) => unwrap<PayslipRow[]>(api.get(`/payroll/runs/${runId}/payslips`)),
  bankExport: (runId: string) => unwrap<BankExportRow[]>(api.get(`/payroll/runs/${runId}/bank-export`)),
  myPayslips: () => unwrap<PayslipRow[]>(api.get('/payroll/payslips/me')),
  userPayslips: (userId: string) => unwrap<PayslipRow[]>(api.get(`/payroll/users/${userId}/payslips`)),
  create: (body: CreatePayrollRunInput) => unwrap<PayrollRunRow>(api.post('/payroll/runs', body)),
  recompute: (id: string) => unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/recompute`, {})),
  finalize: (id: string, body: FinalizePayrollRunInput) =>
    unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/finalize`, body)),
  markPaid: (id: string, body: { paidAt?: string; notes?: string }) =>
    unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/mark-paid`, body)),
  reopen: (id: string) => unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/reopen`, {})),
  addAdjustment: (payslipId: string, body: PayslipAdjustmentInput) =>
    unwrap<PayslipRow>(api.post(`/payroll/payslips/${payslipId}/adjustments`, body)),
  removeAdjustment: (payslipId: string, idx: number) =>
    unwrap<PayslipRow>(api.delete(`/payroll/payslips/${payslipId}/adjustments/${idx}`)),
};

const invalidatePayroll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['payroll'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
};

export function usePayrollRuns() {
  return useQuery({ queryKey: qk.payroll.runs(), queryFn: payrollApi.runs });
}
export function usePayrollRun(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.payroll.run(id) : ['payroll', 'run', 'undefined'],
    queryFn: () => payrollApi.run(id!),
    enabled: !!id,
  });
}
export function useRunPayslips(runId: string | undefined) {
  return useQuery({
    queryKey: runId ? ['payroll', 'run', runId, 'payslips'] : ['payroll', 'run', 'undefined', 'payslips'],
    queryFn: () => payrollApi.payslips(runId!),
    enabled: !!runId,
  });
}
export function useMyPayslips() {
  return useQuery({ queryKey: qk.payroll.payslips(), queryFn: payrollApi.myPayslips });
}
export function useUserPayslips(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: userId ? ['payroll', 'user', userId, 'payslips'] : ['payroll', 'user', 'undefined', 'payslips'],
    queryFn: () => payrollApi.userPayslips(userId!),
    enabled: !!userId && enabled,
  });
}
/** Create a draft run. Errors are left to the caller (shown inline). */
export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePayrollRunInput) => payrollApi.create(body),
    onSuccess: (run) => {
      invalidatePayroll(qc);
      toast.success(`Draft created for ${monthTitle(run.month)}`);
    },
  });
}
export function useRecomputePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.recompute(id),
    onSuccess: () => {
      invalidatePayroll(qc);
      toast.success('Payslips recalculated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useFinalizePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: FinalizePayrollRunInput }) => payrollApi.finalize(vars.id, vars.body),
    onSuccess: (run) => {
      invalidatePayroll(qc);
      toast.success(`${monthTitle(run.month)} payroll finalized — payslips are on their way`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useMarkPayrollPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; paidAt?: string }) => payrollApi.markPaid(vars.id, { paidAt: vars.paidAt }),
    onSuccess: (run) => {
      invalidatePayroll(qc);
      toast.success(`${monthTitle(run.month)} payroll marked paid`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useReopenPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.reopen(id),
    onSuccess: (run) => {
      invalidatePayroll(qc);
      toast.success(`${monthTitle(run.month)} payroll reopened as a draft`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
/** Add a bonus / deduction. Errors are left to the form. */
export function useAddPayslipAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { payslipId: string; body: PayslipAdjustmentInput }) =>
      payrollApi.addAdjustment(vars.payslipId, vars.body),
    onSuccess: () => {
      invalidatePayroll(qc);
      toast.success('Adjustment added');
    },
  });
}
export function useRemovePayslipAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { payslipId: string; idx: number }) =>
      payrollApi.removeAdjustment(vars.payslipId, vars.idx),
    onSuccess: () => {
      invalidatePayroll(qc);
      toast.success('Adjustment removed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
