// CRM pipeline page — opportunity columns by stage (OWNER-only).
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  CrmStage,
  Role,
  createOpportunitySchema,
  type CreateOpportunityInput,
} from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useClients } from '@/features/clients/clients.hooks';
import {
  useCreateOpportunity,
  useMoveOpportunity,
  usePipeline,
} from '@/features/clients/clients.hooks';

const STAGES: CrmStage[] = [
  CrmStage.LEAD,
  CrmStage.QUALIFIED,
  CrmStage.PROPOSAL,
  CrmStage.NEGOTIATION,
  CrmStage.WON,
  CrmStage.LOST,
];

export default function CrmPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const pipeline = usePipeline();
  const move = useMoveOpportunity();
  const create = useCreateOpportunity();
  const clients = useClients();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateOpportunityInput>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: { title: '', valuePaise: 0, stage: CrmStage.LEAD },
  });

  const grouped: Record<CrmStage, typeof pipeline.data> = STAGES.reduce(
    (acc, s) => ({ ...acc, [s]: [] }),
    {} as Record<CrmStage, typeof pipeline.data>,
  );
  for (const o of pipeline.data ?? []) (grouped[o.stage] ??= []).push(o);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Pipeline"
        description="Manage leads and opportunities by stage."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New opportunity</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add opportunity</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(v, {
                  onSuccess: () => {
                    setOpen(false);
                    form.reset();
                  },
                }),
              )}
            >
              <div className="space-y-1">
                <Label>Client</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register('clientId')}
                >
                  <option value="">Select…</option>
                  {(clients.data ?? []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input {...form.register('title')} />
              </div>
              <div className="space-y-1">
                <Label>Value (paise)</Label>
                <Input type="number" {...form.register('valuePaise', { valueAsNumber: true })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const items = grouped[stage] ?? [];
          const total = items.reduce((s, o) => s + o.valuePaise, 0);
          return (
            <Card key={stage}>
              <CardHeader>
                <CardTitle className="text-sm">
                  {stage} <span className="text-muted-foreground">({items.length})</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{formatPaise(total, 'INR')}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((o) => (
                  <div key={o._id} className="rounded border p-2 text-xs">
                    <p className="font-medium">{o.title}</p>
                    <p className="text-muted-foreground">{formatPaise(o.valuePaise, o.currency)}</p>
                    <select
                      className="mt-2 w-full rounded border bg-background px-2 py-1 text-xs"
                      value={o.stage}
                      onChange={(e) =>
                        move.mutate({
                          id: o._id,
                          body: { stage: e.target.value as CrmStage, position: o.position },
                        })
                      }
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
