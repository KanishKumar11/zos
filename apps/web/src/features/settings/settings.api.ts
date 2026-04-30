// Settings + Holidays API client.
import { api, unwrap } from '@/lib/api-client';

import type {
  CreateHolidayInput,
  UpdateHolidayInput,
  UpdateSettingsInput,
} from '@agency/shared';

export interface SettingsRow {
  workspaceName: string;
  defaultCurrency: string;
  timezone: string;
  locale: string;
  weekendDays: number[];
  annualLeavePerYear: number;
  sickLeavePerYear: number;
  logoKey?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  gstin?: string;
  pan?: string;
}
export interface HolidayRow {
  _id: string;
  name: string;
  date: string;
  optional?: boolean;
  note?: string;
}

export const settingsApi = {
  get: () => unwrap<SettingsRow>(api.get('/settings')),
  update: (body: UpdateSettingsInput) => unwrap<SettingsRow>(api.patch('/settings', body)),
};

export const holidaysApi = {
  list: (year?: number) => unwrap<HolidayRow[]>(api.get('/holidays', { params: { year } })),
  create: (body: CreateHolidayInput) => unwrap<HolidayRow>(api.post('/holidays', body)),
  update: (id: string, body: UpdateHolidayInput) => unwrap<HolidayRow>(api.patch(`/holidays/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/holidays/${id}`)),
};
