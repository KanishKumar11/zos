// Project detail — opens with one sentence about where the project stands, then tabs.
// The owner sees the commercial side (health, burn, people & payments, billing journey); everyone
// else sees the work view plus their own earnings on the project. Same tabs and actions as before.
'use client';

import { Archive, Eye, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { use, useState } from 'react';

import { Role } from '@agency/shared';

import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bento, PrivacyChip, ProjectChip } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { ProjectFiles, ProjectUpdates } from '@/features/collab/project-collab';
import { PeoplePayments } from '@/features/projects/components/people-payments';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { ProjectMilestones, ProjectMoneySummary } from '@/features/projects/components/project-money';
import { OwnerProjectHero, OwnerProjectOverview, StaffProjectHero, StaffProjectOverview } from '@/features/projects/components/project-overview';
import { ProjectTeam } from '@/features/projects/components/project-team';
import { useDeleteProject, useProject, type ProjectRow } from '@/features/projects/projects.hooks';
import { CloseProjectSheet } from '@/features/projects/components/close-project-sheet';
import { ProjectTasks } from '@/features/tasks/project-tasks';
import { FEATURES } from '@/lib/features';
import { formatDate } from '@/lib/formatters';

const CRUMBS = [{ label: 'Projects', href: '/projects' }];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const canEdit = isOwner || role === Role.ADMIN || role === Role.LEAD;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const rawTab = search.get('tab') ?? 'overview';
  const tab = rawTab === 'tasks' && !FEATURES.tasks ? 'overview' : rawTab;
  const setTab = (t: string) => router.replace(`${pathname}${t === 'overview' ? '' : `?tab=${t}`}`, { scroll: false });

  if (project.isLoading) return <PageSkeleton />;
  if (project.isError || !project.data) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState title="Couldn't open this project" error={project.error} onRetry={() => project.refetch()} />
      </div>
    );
  }
  const p = project.data;

  return (
    <div className="space-y-7">
      <ProjectHeader project={p} isOwner={isOwner} canEdit={canEdit} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isOwner ? <TabsTrigger value="people">People &amp; payments</TabsTrigger> : <TabsTrigger value="team">Team</TabsTrigger>}
          {isOwner && <TabsTrigger value="billing">Billing</TabsTrigger>}
          {FEATURES.tasks && <TabsTrigger value="tasks">Tasks</TabsTrigger>}
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {isOwner ? <OwnerProjectOverview project={p} onOpenTab={setTab} /> : <StaffProjectOverview project={p} onOpenTab={setTab} />}
        </TabsContent>

        {isOwner ? (
          <TabsContent value="people">
            <Bento>
              <PeoplePayments project={p} />
            </Bento>
          </TabsContent>
        ) : (
          <TabsContent value="team">
            <ProjectTeam project={p} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="billing" className="space-y-3.5">
            <ProjectMoneySummary project={p} />
            <Bento>
              <ProjectMilestones project={p} />
            </Bento>
          </TabsContent>
        )}

        {FEATURES.tasks && (
          <TabsContent value="tasks">
            <ProjectTasks project={p} />
          </TabsContent>
        )}
        <TabsContent value="updates">
          <ProjectUpdates projectId={p._id} hasClient={!!p.clientId || !isOwner} />
        </TabsContent>
        <TabsContent value="files">
          <ProjectFiles projectId={p._id} hasClient={!!p.clientId || !isOwner} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectHeader({ project: p, isOwner, canEdit }: { project: ProjectRow; isOwner: boolean; canEdit: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useDeleteProject();
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const clients = useClients(undefined, { enabled: isOwner && !!p.clientId });
  const clientName = p.clientId ? (clients.data?.find((c) => c._id === p.clientId)?.name ?? (clients.isLoading ? undefined : 'Deleted client')) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const eyebrow = (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
        <ProjectChip id={p._id} name={p.name} />
        {isOwner && <span className="text-muted-foreground">· {p.clientId ? (clientName ?? '…') : 'Internal'}</span>}
      </span>
      <span className="font-figures text-xs">{p.code}</span>
      <StatusBadge status={p.status} />
    </span>
  );

  const aside = (
    <>
      {isOwner ? <PrivacyChip>Owner view</PrivacyChip> : p.myEngagement ? <PrivacyChip>Shows only your own pay</PrivacyChip> : null}
      {isOwner && (
        <Button size="sm" variant="brand" onClick={() => openLogPayment({ projectId: p._id })}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
        </Button>
      )}
      {canEdit && (
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
      )}
      {isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" className="h-8 w-8" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {p.clientId && (
              <DropdownMenuItem asChild>
                <Link href={`/portal-preview/projects/${p._id}`}>
                  <Eye className="mr-2 h-3.5 w-3.5" /> Preview as client
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/payments?projectId=${p._id}`}>All payments on this project</Link>
            </DropdownMenuItem>
            {!p.closedAt && (
              <DropdownMenuItem onClick={() => setCloseOpen(true)}>
                <Archive className="mr-2 h-3.5 w-3.5" /> Close project…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${p.name}?`,
                  description:
                    'The project disappears for everyone, including the client portal. Payments and invoices already recorded are kept for your books.',
                  confirmText: 'Delete project',
                  destructive: true,
                });
                if (!ok) return;
                await remove.mutateAsync(p._id);
                router.push('/projects');
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );

  return (
    <>
      {isOwner ? (
        <OwnerProjectHero project={p} crumbs={CRUMBS} eyebrow={eyebrow} aside={aside} />
      ) : (
        <StaffProjectHero project={p} crumbs={CRUMBS} eyebrow={eyebrow} aside={aside} />
      )}
      {p.closedAt && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border bg-muted/40 px-4 py-2.5 text-sm">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span>
            Closed on {formatDate(p.closedAt)}
            {isOwner && p.writtenOffAt && ' · the unbilled part of the budget was written off'}
            {isOwner && p.closeNote && ` · ${p.closeNote}`}
          </span>
        </div>
      )}
      {canEdit && <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={p} />}
      {isOwner && closeOpen && <CloseProjectSheet project={p} open={closeOpen} onOpenChange={setCloseOpen} />}
    </>
  );
}
