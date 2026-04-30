// Compensation page for a specific team member — OWNER only.
'use client';

import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { CompensationType, Role, upsertCompensationSchema } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { RoleGate } from '@/components/auth/role-gate';
import { formatPaise } from '@/lib/formatters';

import {
  useCompensation,
  useCompensationHistory,
  useUpsertCompensation,
} from '@/features/compensation/compensation.hooks';
import { useTeamMember } from '@/features/team/team.hooks';

export default function MemberCompensationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const member = useTeamMember(id);
  const comp = useCompensation(id);
  const history = useCompensationHistory(id);
  const upsert = useUpsertCompensation();

  const form = useForm<z.input<typeof upsertCompensationSchema>>({
    resolver: zodResolver(upsertCompensationSchema) as never,
    defaultValues: {
      type: CompensationType.FIXED_MONTHLY,
      baseAmount: 0,
      currency: 'INR',
      hra: 0,
      specialAllowance: 0,
      providentFundEmployee: 0,
      providentFundEmployer: 0,
      professionalTax: 0,
      tdsMonthly: 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    } as never,
  });

  useEffect(() => {
    if (comp.data) {
      form.reset({
        type: comp.data.type,
        baseAmount: comp.data.baseAmount,
        currency: comp.data.currency,
        hra: comp.data.hra,
        specialAllowance: comp.data.specialAllowance,
        providentFundEmployee: comp.data.providentFundEmployee,
        providentFundEmployer: comp.data.providentFundEmployer,
        professionalTax: comp.data.professionalTax,
        tdsMonthly: comp.data.tdsMonthly,
        effectiveFrom: comp.data.effectiveFrom.slice(0, 10),
      } as never);
    }
  }, [comp.data, form]);

  const onSubmit = form.handleSubmit((values) => upsert.mutate({ userId: id, body: values as never }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compensation</h1>
        {member.data && (
          <p className="text-sm text-muted-foreground">
            For {member.data.name} ({member.data.email})
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current package</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select {...form.register('type')}>
                {Object.values(CompensationType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <Money label="Base (paise)" {...form.register('baseAmount', { valueAsNumber: true })} />
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input {...form.register('currency')} />
            </div>
            <Money label="HRA" {...form.register('hra', { valueAsNumber: true })} />
            <Money label="Special allowance" {...form.register('specialAllowance', { valueAsNumber: true })} />
            <Money label="PF (employee)" {...form.register('providentFundEmployee', { valueAsNumber: true })} />
            <Money label="PF (employer)" {...form.register('providentFundEmployer', { valueAsNumber: true })} />
            <Money label="Professional tax" {...form.register('professionalTax', { valueAsNumber: true })} />
            <Money label="TDS (monthly)" {...form.register('tdsMonthly', { valueAsNumber: true })} />
            <div className="space-y-1">
              <Label>Effective from</Label>
              <Input type="date" {...form.register('effectiveFrom')} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Reason for change</Label>
              <Input {...form.register('reason')} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.data && history.data.length > 0 ? (
            <ul className="divide-y text-sm">
              {history.data.map((h) => (
                <li key={h._id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span>
                      {h.type} · {formatPaise(h.baseAmount, h.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.effectiveFrom).toLocaleDateString()}
                    </span>
                  </div>
                  {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No prior versions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Money({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" min={0} {...props} />
    </div>
  );
}
