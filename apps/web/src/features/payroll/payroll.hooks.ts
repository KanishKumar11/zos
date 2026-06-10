// Payroll API + hooks. Run management is OWNER+ADMIN. Payslips: own (member) or run-scoped (admin).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PayrollStatus, type CreatePayrollRunInput, type FinalizePayrollRunInput } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface PayrollRunRow {
  _id: string;
  month: string;
  status: PayrollStatus;
  totalNetPaise: number;
  employeeCount: number;
  finalizedAt?: string;
  notes?: string;
}
export interface PayslipRow {
  _id: string;
  runId: string;
  month: string;
  userId: string;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  workingDays: number;
  presentDays: number;
  lopDays: number;
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
  };
  projectPayments?: {
    projectId: string;
    projectName: string;
    amountPaise: number;
    paidAt: string;
    note: string;
  }[];
}

const payrollApi = {
  runs: () => unwrap<PayrollRunRow[]>(api.get('/payroll/runs')),
  run: (id: string) => unwrap<PayrollRunRow>(api.get(`/payroll/runs/${id}`)),
  payslips: (runId: string) => unwrap<PayslipRow[]>(api.get(`/payroll/runs/${runId}/payslips`)),
  myPayslips: () => unwrap<PayslipRow[]>(api.get('/payroll/payslips/me')),
  create: (body: CreatePayrollRunInput) => unwrap<PayrollRunRow>(api.post('/payroll/runs', body)),
  recompute: (id: string) => unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/recompute`, {})),
  finalize: (id: string, body: FinalizePayrollRunInput) =>
    unwrap<PayrollRunRow>(api.post(`/payroll/runs/${id}/finalize`, body)),
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
export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePayrollRunInput) => payrollApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Payroll run created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useRecomputePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.recompute(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Recomputed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useFinalizePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: FinalizePayrollRunInput }) =>
      payrollApi.finalize(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Run finalized');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
