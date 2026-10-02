// Freelancer profile — contact & payment details, deals across projects, and every payment.
'use client';

import { Copy, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { toast } from 'sonner';

import { PAYOUT_METHOD_LABEL, PayeeType } from '@agency/shared';

import { formatDate, formatPaise } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { FreelancerFormDialog } from '@/features/freelancers/freelancer-form-dialog';
import { useDeleteFreelancer, useFreelancer, useLinkLegacyEngagement } from '@/features/freelancers/freelancers.hooks';
import { usePayouts } from '@/features/payouts/payouts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

export default function FreelancerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fl = useFreelancer(id);
  const payouts = usePayouts({ freelancerId: id, pageSize: 200 });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const remove = useDeleteFreelancer();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);

  if (fl.isLoading) return <PageSkeleton />;
  if (fl.isError || !fl.data) return <ErrorState title="Couldn't open this freelancer" error={fl.error} onRetry={() => fl.refetch()} />;
  const f = fl.data;
  const projects = f.balances.filter((b) => b.projectId);
  const agreed = f.balances.reduce((s, b) => s + b.agreedPaise, 0) + f.legacyEngagements.reduce((s, l) => s + l.agreedPaise, 0);
  const paid = f.balances.reduce((s, b) => s + b.paidPaise, 0);

  const copy = (label: string, value?: string) => {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={f.name}
        crumbs={[{ label: 'Freelancers', href: '/freelancers' }]}
        description={[f.skill, f.email, f.phone].filter(Boolean).join(' · ') || undefined}
        action={
          <>
            <Button size="sm" onClick={() => openLogPayment({ payeeType: 'FREELANCER', freelancerId: id })}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Remove freelancer"
              onClick={async () => {
                const ok = await confirm({
                  title: `Remove ${f.name}?`,
                  description: 'They disappear from pickers. Their payments stay in the ledger for your records.',
                  destructive: true,
                  confirmText: 'Remove',
                });
                if (!ok) return;
                await remove.mutateAsync(id);
                router.push('/freelancers');
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agreed across projects" value={formatPaise(agreed)} />
        <StatCard label="Paid" tone="success" value={formatPaise(paid)} href={`/payments?freelancerId=${id}`} />
        <StatCard label="Still owed" tone={agreed - paid > 0 ? 'warning' : 'default'} value={formatPaise(Math.max(0, agreed - paid))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {f.legacyEngagements.length > 0 && <LegacyLinks freelancerId={id} items={f.legacyEngagements} />}

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <EmptyState title="Not on any project yet" description="Open a project → People & payments → Add person → Freelancer." />
              ) : (
                <ul className="divide-y">
                  {projects.map((b) => (
                    <li key={b.projectId} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_200px_auto] sm:items-center">
                      <div>
                        <Link href={`/projects/${b.projectId}?tab=people`} className="font-medium hover:underline">
                          {b.projectName}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {b.projectStatus && <StatusBadge status={b.projectStatus} />}
                          <span>
                            {formatPaise(b.paidPaise)} of {b.agreedPaise ? formatPaise(b.agreedPaise) : 'no fee set'}
                          </span>
                        </div>
                      </div>
                      {b.agreedPaise > 0 ? <ProgressBar value={b.paidPaise} max={b.agreedPaise} /> : <span />}
                      <Button
                        size="sm"
                        variant={b.pendingPaise > 0 ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-xs"
                        onClick={() =>
                          openLogPayment({ payeeType: PayeeType.FREELANCER, freelancerId: id, projectId: b.projectId!, amountPaise: b.pendingPaise || undefined })
                        }
                      >
                        {b.pendingPaise > 0 ? `Pay ${formatPaise(b.pendingPaise)}` : 'Pay'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(payouts.data?.items ?? []).length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <ul className="divide-y">
                  {payouts.data!.items.map((p) => (
                    <li key={p._id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] hover:bg-muted/30"
                        onClick={() => openLogPayment({}, p._id)}
                      >
                        <span className="w-24 shrink-0 text-muted-foreground">{formatDate(p.paidAt)}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {p.projectName ?? 'General'}
                          <span className="text-muted-foreground">
                            {' '}
                            · {PAYOUT_METHOD_LABEL[p.method]}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </span>
                        </span>
                        <span className="font-medium tabular-nums">{formatPaise(p.amountPaise, p.currency)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {[
              ['UPI', f.upiId],
              ['Bank', f.bankName],
              ['Account', f.accountNumber],
              ['IFSC', f.ifsc],
              ['PAN', f.pan],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                {value ? (
                  <button type="button" className="flex items-center gap-1.5 font-mono text-[13px] hover:text-primary" onClick={() => copy(label!, value)} title="Copy">
                    {value} <Copy className="h-3 w-3 opacity-50" />
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            ))}
            {f.notes && <p className="whitespace-pre-line border-t pt-3 text-[13px] text-muted-foreground">{f.notes}</p>}
          </CardContent>
        </Card>
      </div>

      <FreelancerFormDialog open={editOpen} onOpenChange={setEditOpen} freelancer={f} />
    </div>
  );
}

function LegacyLinks({ freelancerId, items }: { freelancerId: string; items: { legacyId: string; projectRef: string; agreedPaise: number }[] }) {
  const projects = useAllProjects();
  const link = useLinkLegacyEngagement();
  const [choice, setChoice] = useState<Record<string, string | undefined>>({});
  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle>Older agreements to link</CardTitle>
        <p className="text-[13px] text-muted-foreground">These were imported from the old freelancer records. Pick the project each one belongs to.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((l) => (
          <div key={l.legacyId} className="grid gap-2 sm:grid-cols-[1fr_240px_auto] sm:items-center">
            <div className="text-sm">
              <p className="font-medium">“{l.projectRef}”</p>
              <p className="text-xs text-muted-foreground">Agreed {formatPaise(l.agreedPaise)}</p>
            </div>
            <Combobox
              options={(projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name, keywords: p.code }))}
              value={choice[l.legacyId]}
              onChange={(v) => setChoice((c) => ({ ...c, [l.legacyId]: v }))}
              placeholder="Choose project"
            />
            <Button
              size="sm"
              className="h-9"
              disabled={!choice[l.legacyId] || link.isPending}
              onClick={() => link.mutate({ id: freelancerId, legacyId: l.legacyId, projectId: choice[l.legacyId]! })}
            >
              Link
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
