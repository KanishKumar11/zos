// Departments + Designations API client.
import { api, unwrap } from '@/lib/api-client';

import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  UpdateDepartmentInput,
  UpdateDesignationInput,
} from '@agency/shared';

export interface DepartmentRow {
  _id: string;
  name: string;
  description?: string;
  headUserId?: string;
}
export interface DesignationRow {
  _id: string;
  title: string;
  departmentId: string;
  description?: string;
  seniorityLevel?: number;
}

export const departmentsApi = {
  list: () => unwrap<DepartmentRow[]>(api.get('/departments')),
  byId: (id: string) => unwrap<DepartmentRow>(api.get(`/departments/${id}`)),
  create: (body: CreateDepartmentInput) => unwrap<DepartmentRow>(api.post('/departments', body)),
  update: (id: string, body: UpdateDepartmentInput) =>
    unwrap<DepartmentRow>(api.patch(`/departments/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/departments/${id}`)),
};

export const designationsApi = {
  list: (departmentId?: string) =>
    unwrap<DesignationRow[]>(api.get('/designations', { params: { departmentId } })),
  byId: (id: string) => unwrap<DesignationRow>(api.get(`/designations/${id}`)),
  create: (body: CreateDesignationInput) =>
    unwrap<DesignationRow>(api.post('/designations', body)),
  update: (id: string, body: UpdateDesignationInput) =>
    unwrap<DesignationRow>(api.patch(`/designations/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/designations/${id}`)),
};
