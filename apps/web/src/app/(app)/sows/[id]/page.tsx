// SOW detail — scope, milestones, signature status, signed copy and "create project" (OWNER-only).
'use client';

import { AlertTriangle, ExternalLink, FolderPlus, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Role } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { getDownloadUrl } from '@/lib/upload';

import { RoleGate } from '@/components/auth/role-gate';
import { FileUploader } from '@/components/file-uploader';
import { DataTable, type Column } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { Bento, BigNumber, Legend, Price, PrivacyChip, ProjectChip, SegmentBar, Tile, formatCompact, useCanSeePrices } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { ClientChip } from '@/features/contracts/price-totals';
import { useProject } from '@/features/projects/projects.hooks';
import { CreateProjectFromSowDialog } from '@/features/sow/create-project-dialog';
import { SowFormDialog } from '@/features/sow/sow-form-dialog';
import {
  SOW_STATUS_LABEL,
  sowStatus,
  useDeleteSow,
  usePublishSowBrief,
  useSetSowDocument,
  useSow,
  useUpdateSow,
  type SowBriefRow,
  type SowMilestoneRow,
} from '@/features/sow/sow.hooks';
import { MILESTONE_COLOR, MILESTONE_LABEL, milestoneProgress, SowJourney } from '@/features/sow/sow-visuals';

export default function SowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowDetailInner id={id} />
    </RoleGate>
  );
}

function SowDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const canSee = useCanSeePrices();
  const sow = useSow(id);
  const clients = useClients();
  const project = useProject(sow.data?.projectId);
  const updateSow = useUpdateSow({ toast: false });
  const del = useDeleteSow();
  const setDocument = useSetSowDocument();
  const [editOpen, setEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [signedOn, setSignedOn] = useState(todayLocal());
  const [opening, setOpening] = useState(false);

  if (sow.isLoading) return <PageSkeleton />;
  if (sow.error || !sow.data) {
    const notFound = sow.error instanceof ApiRequestError && sow.error.status === 404;
    return (
      <div className="space-y-5">
        <PageHeader title={notFound ? 'SOW not found' : 'Statement of work'} crumbs={[{ label: 'Statements of work', href: '/sows' }]} />
        {notFound ? (
          <EmptyState
            illustration="files"
            title="This SOW doesn’t exist or was deleted"
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/sows">Back to SOWs</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={sow.error} onRetry={() => sow.refetch()} />
        )}
      </div>
    );
  }

  const s = sow.data;
  const status = sowStatus(s);
  const client = clients.data?.find((c) => c._id === s.clientId);
  const clientLabel = client?.name ?? (clients.isLoading ? '…' : 'Deleted client');
  const msTotal = s.milestones.reduce((sum, m) => sum + m.amountPaise, 0);
  const mismatch = s.milestones.length > 0 && msTotal !== s.totalValuePaise;
  const projectMissing = !!s.projectId && !project.isLoading && !project.data;
  const hasProject = !!s.projectId && !!project.data;
  const progress = milestoneProgress(s.milestones);
  const money = (p: number) => (canSee ? formatCompact(p, s.currency) : '');

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${s.title}?`,
      description: hasProject
        ? `The project ${project.data!.name} stays — only the SOW and its signed copy link are removed.`
        : 'The SOW, its milestones and brief are removed. This can’t be undone.',
      confirmText: 'Delete SOW',
      destructive: true,
    });
    if (ok) del.mutate(id, { onSuccess: () => router.push('/sows') });
  };

  const markSent = () =>
    updateSow.mutate(
      { id, body: { sentAt: todayLocal() } },
      { onSuccess: () => toast.success('Marked as sent'), onError: (e) => toast.error(getErrorMessage(e)) },
    );
  const markSigned = () =>
    updateSow.mutate(
      { id, body: { signedAt: signedOn || todayLocal() } },
      { onSuccess: () => toast.success('Marked as signed'), onError: (e) => toast.error(getErrorMessage(e)) },
    );
  const unsign = async () => {
    const ok = await confirm({ title: 'Mark as not signed?', description: 'The signed date is cleared. Any attached signed copy stays attached.', confirmText: 'Mark not signed' });
    if (ok) updateSow.mutate({ id, body: { signedAt: null } }, { onError: (e) => toast.error(getErrorMessage(e)) });
  };

  const openSignedCopy = async () => {
    if (!s.documentKey) return;
    // Open the tab now (popup blockers allow it inside the click), then point it at the signed URL.
    const tab = window.open('', '_blank');
    setOpening(true);
    try {
      const url = await getDownloadUrl(s.documentKey);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      toast.error(getErrorMessage(err, "Couldn't open the signed copy"));
    } finally {
      setOpening(false);
    }
  };

  const milestoneColumns: Column<SowMilestoneRow>[] = [
    {
      id: 'title',
      header: 'Milestone',
      cell: (m) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MILESTONE_COLOR[m.status] }} />
          {m.title}
        </span>
      ),
    },
    {
      id: 'due',
      header: 'Due',
      cell: (m) => (m.dueDate ? formatDate(m.dueDate) : <span className="text-muted-foreground">—</span>),
    },
    { id: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (m) => <Price paise={m.amountPaise} currency={s.currency} />,
      footer: <Price paise={msTotal} currency={s.currency} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.title}
        eyebrow={<ClientChip clientId={s.clientId} name={client?.name} loading={clients.isLoading} href={client ? `/clients/${client._id}` : undefined} />}
        crumbs={[
          { label: 'Statements of work', href: '/sows' },
          ...(client ? [{ label: client.name, href: `/sows?clientId=${client._id}` }] : []),
        ]}
        meta={
          <>
            <Badge variant={status === 'SIGNED' ? 'success' : status === 'SENT' ? 'info' : 'muted'}>{SOW_STATUS_LABEL[status]}</Badge>
            {status !== 'SIGNED' && <Badge variant="outline">Unsigned</Badge>}
          </>
        }
        action={
          <>
            {status === 'DRAFT' && (
              <Button size="sm" variant="outline" onClick={markSent} disabled={updateSow.isPending}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> Mark as sent
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => void remove()} disabled={del.isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </>
        }
      />

      <div className="flex justify-end">
        <PrivacyChip>Only you see these figures</PrivacyChip>
      </div>

      <Bento>
        <Tile span={4} tone="ink" title="Total value">
          <BigNumber
            className="[&>div]:text-brand"
            caption={
              s.milestones.length === 0 ? (
                'Before GST · no milestones yet'
              ) : mismatch ? (
                <>
                  Before GST · milestones are <Price paise={Math.abs(s.totalValuePaise - msTotal)} currency={s.currency} />{' '}
                  {msTotal > s.totalValuePaise ? 'over' : 'short of'} the total
                </>
              ) : (
                `Before GST · ${s.milestones.length} milestone${s.milestones.length === 1 ? '' : 's'}, matching the total`
              )
            }
          >
            <Price paise={s.totalValuePaise} currency={s.currency} />
          </BigNumber>
        </Tile>

        <Tile span={4} title="Signature">
          <BigNumber caption={s.signedAt ? `Signed ${formatDate(s.signedAt)}` : s.sentAt ? `Sent ${formatDate(s.sentAt)} — not signed yet` : 'Not sent to the client yet'}>
            <span className={status === 'SIGNED' ? 'text-success' : status === 'SENT' ? 'text-info' : undefined}>
              {status === 'SIGNED' ? 'Signed' : status === 'SENT' ? 'Awaiting' : 'Draft'}
            </span>
          </BigNumber>
          {status === 'DRAFT' && (
            <Button size="sm" variant="outline" className="mt-3" onClick={markSent} disabled={updateSow.isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Mark as sent
            </Button>
          )}
        </Tile>

        <Tile span={4} title="Project">
          {hasProject ? (
            <div className="space-y-3">
              <ProjectChip id={project.data!._id} name={project.data!.name} href={`/projects/${project.data!._id}`} className="font-display text-xl font-bold" />
              <div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/projects/${project.data!._id}`}>Open project</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">{projectMissing ? 'The linked project was deleted' : 'No project yet'}</p>
              <p className="text-xs text-muted-foreground">Start the project with this SOW’s client, budget and milestones already filled in.</p>
              <Button size="sm" variant="brand" onClick={() => setProjectOpen(true)} disabled={!client || (!!s.projectId && project.isLoading)}>
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Create project from SOW
              </Button>
              {!client && !clients.isLoading && <p className="text-xs text-warning">The client was deleted, so a project can’t be created.</p>}
            </div>
          )}
        </Tile>

        <Tile
          span={12}
          title="Milestones"
          action={
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              Edit milestones
            </Button>
          }
        >
          {s.milestones.length > 0 ? (
            <div className="space-y-5">
              <SowJourney milestones={s.milestones} currency={s.currency} />
              {msTotal > 0 && (
                <div className="space-y-2">
                  <SegmentBar
                    height="h-7"
                    segments={[
                      { value: progress.collected, color: MILESTONE_COLOR.COLLECTED, label: MILESTONE_LABEL.COLLECTED, display: money(progress.collected) },
                      { value: progress.invoiced, color: MILESTONE_COLOR.INVOICED, label: MILESTONE_LABEL.INVOICED, display: money(progress.invoiced) },
                      { value: progress.pending, color: 'hsl(var(--muted-foreground) / 0.45)', label: MILESTONE_LABEL.PENDING, display: money(progress.pending) },
                    ]}
                  />
                  <Legend
                    items={[
                      { color: MILESTONE_COLOR.COLLECTED, label: 'Collected' },
                      { color: MILESTONE_COLOR.INVOICED, label: 'Invoiced, not paid' },
                      { color: 'hsl(var(--muted-foreground) / 0.45)', label: 'Not billed yet' },
                    ]}
                  />
                </div>
              )}
              {mismatch && (
                <p className="flex flex-wrap items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Milestones add up to <Price paise={msTotal} currency={s.currency} />, but the SOW is worth <Price paise={s.totalValuePaise} currency={s.currency} />.
                </p>
              )}
            </div>
          ) : null}
          <DataTable
            className={s.milestones.length > 0 ? 'mt-5' : undefined}
            columns={milestoneColumns}
            rows={s.milestones}
            rowKey={(m) => `${m.title}-${m.dueDate ?? ''}-${m.amountPaise}`}
            showFooter
            empty={
              <EmptyState
                illustration="calendar"
                title="No milestones"
                description="Add the payment stages agreed with the client."
                action={
                  <Button size="sm" onClick={() => setEditOpen(true)}>
                    Add milestones
                  </Button>
                }
              />
            }
          />
        </Tile>

        {s.description && (
          <Tile span={12} title="Scope">
            <p className="max-w-[75ch] whitespace-pre-line text-sm">{s.description}</p>
          </Tile>
        )}

        <Tile span={12} title="Signed copy">
          <div className="space-y-4">
            {s.documentKey ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{s.documentKey.split('/').pop()}</p>
                  <p className="text-xs text-muted-foreground">{s.signedAt ? `Signed ${formatDate(s.signedAt)}` : 'Attached'}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void openSignedCopy()} disabled={opening}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> {opening ? 'Opening…' : 'View signed copy'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No signed copy attached yet.</p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Signed on" className="w-44">
                <Input type="date" value={signedOn} max={todayLocal()} onChange={(e) => setSignedOn(e.target.value)} />
              </FormField>
              <FileUploader
                prefix={`sows/${id}`}
                accept="application/pdf,image/*"
                label={s.documentKey ? 'Replace signed copy' : 'Upload signed copy'}
                onUploaded={async (res) => {
                  await setDocument.mutateAsync({
                    id,
                    body: { key: res.key, contentType: res.file.type || undefined, signedAt: signedOn || todayLocal() },
                  });
                }}
              />
              {!s.signedAt && (
                <Button size="sm" variant="ghost" onClick={markSigned} disabled={updateSow.isPending}>
                  Mark signed without a file
                </Button>
              )}
              {s.signedAt && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void unsign()} disabled={updateSow.isPending}>
                  Mark not signed
                </Button>
              )}
            </div>
          </div>
        </Tile>
      </Bento>

      <BriefCard sowId={id} brief={s.brief} />

      <SowFormDialog open={editOpen} onOpenChange={setEditOpen} sow={s} />
      <CreateProjectFromSowDialog
        sow={s}
        clientName={clientLabel}
        open={projectOpen}
        onOpenChange={setProjectOpen}
        onCreated={(pid) => router.push(`/projects/${pid}`)}
      />
    </div>
  );
}


/** The team-facing brief (scope summary, deliverables, timeline) — project members can read it. */
function BriefCard({ sowId, brief }: { sowId: string; brief?: SowBriefRow }) {
  const publishBrief = usePublishSowBrief();
  const [scopeSummary, setScopeSummary] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [timelineStart, setTimelineStart] = useState('');
  const [timelineEnd, setTimelineEnd] = useState('');
  const [revisionRounds, setRevisionRounds] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setScopeSummary(brief?.scopeSummary ?? '');
    setDeliverables((brief?.deliverables ?? []).join('\n'));
    setTimelineStart(brief?.timelineStart?.slice(0, 10) ?? '');
    setTimelineEnd(brief?.timelineEnd?.slice(0, 10) ?? '');
    setRevisionRounds(brief?.revisionRounds !== undefined ? String(brief.revisionRounds) : '');
  }, [brief]);

  const publish = () => {
    const items = deliverables
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    const e: Record<string, string> = {};
    if (scopeSummary.trim().length < 2) e.scopeSummary = 'Summarise the scope';
    if (items.length === 0) e.deliverables = 'List at least one deliverable';
    if (timelineStart && timelineEnd && timelineEnd < timelineStart) e.timelineEnd = 'End must be after the start';
    setErrors(e);
    if (Object.keys(e).length) return;
    publishBrief.mutate({
      id: sowId,
      body: {
        scopeSummary: scopeSummary.trim(),
        deliverables: items,
        ...(timelineStart ? { timelineStart } : {}),
        ...(timelineEnd ? { timelineEnd } : {}),
        revisionRounds: revisionRounds === '' ? 0 : Math.max(0, Math.min(99, Math.round(Number(revisionRounds) || 0))),
      } as never,
    });
  };

  return (
    <Tile title="Team brief">
      <div className="space-y-3">
        <p className="-mt-2 text-xs text-muted-foreground">
          What the project team sees — no prices.
          {brief?.publishedAt && ` Last published ${formatDateTime(brief.publishedAt)}.`}
        </p>
        <FormField label="Scope summary" required error={errors.scopeSummary}>
          <Textarea value={scopeSummary} onChange={(e) => setScopeSummary(e.target.value)} rows={4} />
        </FormField>
        <FormField label="Deliverables" required error={errors.deliverables} hint="One per line">
          <Textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={4} placeholder={'Homepage design\nCMS setup'} />
        </FormField>
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Timeline start">
            <Input type="date" value={timelineStart} onChange={(e) => setTimelineStart(e.target.value)} />
          </FormField>
          <FormField label="Timeline end" error={errors.timelineEnd}>
            <Input type="date" value={timelineEnd} onChange={(e) => setTimelineEnd(e.target.value)} />
          </FormField>
          <FormField label="Revision rounds">
            <Input inputMode="numeric" value={revisionRounds} placeholder="0" onChange={(e) => setRevisionRounds(e.target.value.replace(/\D/g, ''))} />
          </FormField>
        </div>
        <Button onClick={publish} disabled={publishBrief.isPending}>
          {publishBrief.isPending ? 'Publishing…' : brief?.publishedAt ? 'Update brief' : 'Publish brief'}
        </Button>
      </div>
    </Tile>
  );
}
