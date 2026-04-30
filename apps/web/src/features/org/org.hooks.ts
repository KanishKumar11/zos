// React Query hooks for departments + designations.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { qk } from '@/lib/query-keys';

import {
  departmentsApi,
  designationsApi,
  type DepartmentRow,
  type DesignationRow,
} from './org.api';

import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  UpdateDepartmentInput,
  UpdateDesignationInput,
} from '@agency/shared';

// Departments
export function useDepartments() {
  return useQuery({ queryKey: qk.departments.list(), queryFn: departmentsApi.list });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDepartmentInput) => departmentsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.departments.list() });
      toast.success('Department created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateDepartmentInput }) =>
      departmentsApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.departments.list() });
      toast.success('Department updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.departments.list() });
      toast.success('Department deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Designations
export function useDesignations(departmentId?: string) {
  return useQuery({
    queryKey: qk.designations.list({ departmentId }),
    queryFn: () => designationsApi.list(departmentId),
  });
}
export function useCreateDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDesignationInput) => designationsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.designations.all });
      toast.success('Designation created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateDesignationInput }) =>
      designationsApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.designations.all });
      toast.success('Designation updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => designationsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.designations.all });
      toast.success('Designation deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export type { DepartmentRow, DesignationRow };
