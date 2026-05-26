// General workspace settings page.
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { updateSettingsSchema, type UpdateSettingsInput } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PageHeader } from '@/components/layout/page-header';
import { useSettings, useUpdateSettings } from '@/features/settings/settings.hooks';

export default function GeneralSettingsPage() {
  const settings = useSettings();
  const update = useUpdateSettings();

  const form = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (settings.data) {
      form.reset({
        workspaceName: settings.data.workspaceName,
        defaultCurrency: settings.data.defaultCurrency,
        timezone: settings.data.timezone,
        locale: settings.data.locale,
        annualLeavePerYear: settings.data.annualLeavePerYear,
        sickLeavePerYear: settings.data.sickLeavePerYear,
        addressLine1: settings.data.addressLine1 ?? '',
        addressLine2: settings.data.addressLine2 ?? '',
        city: settings.data.city ?? '',
        state: settings.data.state ?? '',
        postalCode: settings.data.postalCode ?? '',
        country: settings.data.country ?? '',
        gstin: settings.data.gstin ?? '',
        pan: settings.data.pan ?? '',
      });
    }
  }, [settings.data, form]);

  const onSubmit = form.handleSubmit((values) => update.mutate(values));

  return (
    <div className="space-y-6">
      <PageHeader title="General settings" description="Workspace name, currency, and locale." />
      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Workspace name" {...form.register('workspaceName')} />
            <Field label="Default currency (ISO)" {...form.register('defaultCurrency')} />
            <Field label="Timezone" {...form.register('timezone')} />
            <Field label="Locale" {...form.register('locale')} />
            <Field
              label="Annual leave per year"
              type="number"
              {...form.register('annualLeavePerYear', { valueAsNumber: true })}
            />
            <Field
              label="Sick leave per year"
              type="number"
              {...form.register('sickLeavePerYear', { valueAsNumber: true })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Address line 1" {...form.register('addressLine1')} />
            <Field label="Address line 2" {...form.register('addressLine2')} />
            <Field label="City" {...form.register('city')} />
            <Field label="State" {...form.register('state')} />
            <Field label="Postal code" {...form.register('postalCode')} />
            <Field label="Country" {...form.register('country')} />
            <Field label="GSTIN" {...form.register('gstin')} />
            <Field label="PAN" {...form.register('pan')} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    <Input {...props} />
  </div>
);
