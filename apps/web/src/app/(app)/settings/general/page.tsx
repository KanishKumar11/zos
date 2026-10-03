// General workspace settings — name, currency, locale, working week, payroll attendance rule,
// billing address. OWNER/ADMIN can edit; everyone else sees it read-only.
'use client';

import { useEffect, useState } from 'react';

import { Role, updateSettingsSchema, type UpdateSettingsInput } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { FEATURES } from '@/lib/features';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import type { SettingsRow } from '@/features/settings/settings.api';
import { useSettings, useUpdateSettings } from '@/features/settings/settings.hooks';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TEXT_FIELDS = [
  'workspaceName',
  'defaultCurrency',
  'timezone',
  'locale',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
  'gstin',
  'pan',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

interface Values {
  text: Record<TextField, string>;
  annualLeavePerYear: string;
  sickLeavePerYear: string;
  weekendDays: number[];
  treatMissingAttendanceAsAbsent: boolean;
}

const fromSettings = (s: SettingsRow): Values => ({
  text: Object.fromEntries(TEXT_FIELDS.map((k) => [k, (s[k] as string | undefined) ?? ''])) as Record<TextField, string>,
  annualLeavePerYear: String(s.annualLeavePerYear ?? ''),
  sickLeavePerYear: String(s.sickLeavePerYear ?? ''),
  weekendDays: s.weekendDays ?? [0, 6],
  treatMissingAttendanceAsAbsent: !!s.treatMissingAttendanceAsAbsent,
});

export default function GeneralSettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === Role.OWNER || role === Role.ADMIN;
  const settings = useSettings();
  const update = useUpdateSettings();
  const [v, setV] = useState<Values>();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (settings.data) setV(fromSettings(settings.data));
  }, [settings.data]);

  if (settings.isLoading || (!v && !settings.isError)) return <PageSkeleton />;
  if (settings.isError || !v) return <ErrorState title="Couldn't load settings" error={settings.error} onRetry={() => settings.refetch()} />;

  const setText = (k: TextField, val: string) => {
    setV((p) => (p ? { ...p, text: { ...p.text, [k]: val } } : p));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const toggleDay = (d: number) => {
    setV((p) => (p ? { ...p, weekendDays: p.weekendDays.includes(d) ? p.weekendDays.filter((x) => x !== d) : [...p.weekendDays, d].sort() } : p));
    setErrors((e) => ({ ...e, weekendDays: undefined }));
  };

  const submit = async () => {
    const body: Record<string, unknown> = {
      ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, v.text[k].trim()])),
      defaultCurrency: v.text.defaultCurrency.trim().toUpperCase(),
      weekendDays: v.weekendDays,
      treatMissingAttendanceAsAbsent: v.treatMissingAttendanceAsAbsent,
    };
    if (FEATURES.leaves) {
      body.annualLeavePerYear = v.annualLeavePerYear === '' ? undefined : Number(v.annualLeavePerYear);
      body.sickLeavePerYear = v.sickLeavePerYear === '' ? undefined : Number(v.sickLeavePerYear);
    }
    const parsed = updateSettingsSchema.safeParse(body);
    const e: Record<string, string> = {};
    if (!parsed.success) {
      for (const [k, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) if (msgs?.[0]) e[k] = msgs[0];
    }
    if (v.weekendDays.length === 7) e.weekendDays = 'At least one day must be a working day';
    setErrors(e);
    if (Object.keys(e).length || !parsed.success) return;
    setServerError(undefined);
    try {
      await update.mutateAsync(parsed.data as UpdateSettingsInput);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const text = (k: TextField, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <FormField label={label} error={errors[k]}>
      <Input value={v.text[k]} onChange={(e) => setText(k, e.target.value)} {...props} />
    </FormField>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="General settings"
        crumbs={[{ label: 'Settings', href: '/settings' }]}
        description={canManage ? 'Workspace details, working week and payroll rules.' : 'Workspace details (view only).'}
      />
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
        <fieldset disabled={!canManage} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {text('workspaceName', 'Workspace name')}
              {text('defaultCurrency', 'Default currency', { maxLength: 3, className: 'uppercase', placeholder: 'INR' })}
              {text('timezone', 'Timezone', { placeholder: 'Asia/Kolkata' })}
              {text('locale', 'Locale', { placeholder: 'en-IN' })}
              {FEATURES.leaves && (
                <>
                  <FormField label="Annual leave per year" error={errors.annualLeavePerYear}>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={v.annualLeavePerYear}
                      onChange={(e) => setV({ ...v, annualLeavePerYear: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Sick leave per year" error={errors.sickLeavePerYear}>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={v.sickLeavePerYear}
                      onChange={(e) => setV({ ...v, sickLeavePerYear: e.target.value })}
                    />
                  </FormField>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Working week & payroll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField label="Weekly days off" error={errors.weekendDays} hint="These days are never counted as working days.">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekly days off">
                  {DAYS.map((label, d) => {
                    const on = v.weekendDays.includes(d);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(d)}
                        className={cn(
                          'h-8 w-12 rounded-md border text-sm transition-colors disabled:cursor-not-allowed',
                          on ? 'border-foreground/40 bg-foreground text-background' : 'hover:bg-accent',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
              {/* With attendance switched off, "missing attendance = absent" would dock everyone's pay, so the
                  option only shows when attendance is on, or while it's still ticked so it can be turned off. */}
              {(FEATURES.attendance || v.treatMissingAttendanceAsAbsent) && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={v.treatMissingAttendanceAsAbsent}
                  onChange={(e) => setV({ ...v, treatMissingAttendanceAsAbsent: e.target.checked })}
                />
                <span>
                  Treat missing attendance as absent
                  <span className="block text-xs text-muted-foreground">
                    Off: only days marked absent are unpaid. On: past working days with no check-in or attendance record are also unpaid.
                    Future days are never counted.
                  </span>
                  {!FEATURES.attendance && (
                    <span className="mt-1 block text-xs font-medium text-destructive">
                      Attendance isn&apos;t in use right now, so with this on every working day counts as unpaid. Untick it and save.
                    </span>
                  )}
                </span>
              </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {text('addressLine1', 'Address line 1')}
              {text('addressLine2', 'Address line 2')}
              {text('city', 'City')}
              {text('state', 'State')}
              {text('postalCode', 'Postal code')}
              {text('country', 'Country')}
              {text('gstin', 'GSTIN', { className: 'uppercase' })}
              {text('pan', 'PAN', { className: 'uppercase' })}
            </CardContent>
          </Card>
        </fieldset>

        {canManage && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={update.isPending} onClick={() => settings.data && setV(fromSettings(settings.data))}>
              Discard changes
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
