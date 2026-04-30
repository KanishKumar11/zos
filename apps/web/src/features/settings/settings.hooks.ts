// React Query hooks for settings + holidays.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  CreateHolidayInput,
  UpdateHolidayInput,
  UpdateSettingsInput,
} from '@agency/shared';

import { qk } from '@/lib/query-keys';

import { holidaysApi, settingsApi } from './settings.api';

export function useSettings() {
  return useQuery({ queryKey: qk.settings.all(), queryFn: settingsApi.get });
}
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsInput) => settingsApi.update(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings.all() });
      toast.success('Settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useHolidays(year?: number) {
  return useQuery({ queryKey: qk.holidays.all(year), queryFn: () => holidaysApi.list(year) });
}
export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateHolidayInput) => holidaysApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateHolidayInput }) => holidaysApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => holidaysApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
