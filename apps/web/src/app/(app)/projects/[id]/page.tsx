// Project detail — one page per project with tabs. The owner sees the commercial side (people &
// payments, billing); everyone else sees the work view plus their own earnings on the project.
'use client';

import { CalendarDays, Eye, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { use, useState } from 'react';

import { Role } from '@agency/shared';

import { formatDate } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients } from '@/features/clients/clients.hooks';
import { ProjectFiles, ProjectUpdates } from '@/features/collab/project-collab';
import { MyProjectEarnings } from '@/features/projects/components/my-project-earnings';
import { PeoplePayments } from '@/features/projects/components/people-payments';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { ProjectMilestones, ProjectMoneySummary } from '@/features/projects/components/project-money';
import { ProjectTeam } from '@/features/projects/components/project-team';
import { useDeleteProject, useProject, type ProjectRow } from '@/features/projects/projects.hooks';
import { ProjectTasks } from '@/features/tasks/project-tasks';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get('tab') ?? 'overview';
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
    <div className="space-y-6">
      <ProjectHeader project={p} isOwner={isOwner} canEdit={isOwner || role === Role.ADMIN || role === Role.LEAD} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isOwner ? <TabsTrigger value="people">People &amp; payments</TabsTrigger> : <TabsTrigger value="team">Team</TabsTrigger>}
          {isOwner && <TabsTrigger value="billing">Billing</TabsTrigger>}
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isOwner && <ProjectMoneySummary project={p} />}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Brief</CardTitle>
                </CardHeader>
                <CardContent>
                  {p.brief ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{p.brief}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No brief yet.</p>
                  )}
                </CardContent>
              </Card>
              {!isOwner && <StaffMilestones project={p} />}
            </div>
            <div className="space-y-6">
              <ProjectFacts project={p} isOwner={isOwner} />
              {!isOwner && p.myEngagement && <MyProjectEarnings engagement={p.myEngagement} />}
            </div>
          </div>
        </TabsContent>

        {isOwner ? (
          <TabsContent value="people">
            <PeoplePayments project={p} />
          </TabsContent>
        ) : (
          <TabsContent value="team">
            <ProjectTeam project={p} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="billing" className="space-y-6">
            <ProjectMoneySummary project={p} />
            <ProjectMilestones project={p} />
          </TabsContent>
        )}

        <TabsContent value="tasks">
          <ProjectTasks project={p} />
        </TabsContent>
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
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <PageHeader
        title={p.name}
        crumbs={[{ label: 'Projects', href: '/projects' }]}
        meta={
          <>
            <StatusBadge status={p.status} />
            <Badge variant="outline" className="font-mono">
              {p.code}
            </Badge>
          </>
        }
        description={p.description || undefined}
        action={
          <>
            {isOwner && (
              <Button size="sm" onClick={() => openLogPayment({ projectId: p._id })}>
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
        }
      />
      {canEdit && <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={p} />}
    </>
  );
}

function ProjectFacts({ project: p, isOwner }: { project: ProjectRow; isOwner: boolean }) {
  const clients = useClients(undefined);
  const client = isOwner && p.clientId ? clients.data?.find((c) => c._id === p.clientId) : undefined;
  const lead = p.members.find((m) => m.role === 'LEAD');
  return (
    <Card>
      <CardContent className="space-y-3 p-5 text-sm">
        {isOwner && (
          <Fact label="Client">
            {p.clientId ? (
              <Link href={`/clients/${p.clientId}`} className="font-medium hover:underline">
                {client?.name ?? 'Client'}
              </Link>
            ) : (
              <span className="text-muted-foreground">Internal project</span>
            )}
          </Fact>
        )}
        <Fact label="Dates">
          {p.startDate || p.endDate ? (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {p.startDate ? formatDate(p.startDate) : 'Not set'} → {p.endDate ? formatDate(p.endDate) : 'Ongoing'}
            </span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </Fact>
        <Fact label="Lead">{lead?.name ?? <span className="text-muted-foreground">No lead</span>}</Fact>
        <Fact label="Team">{p.members.length} people{isOwner && p.freelancers?.length ? ` + ${p.freelancers.length} freelancer${p.freelancers.length === 1 ? '' : 's'}` : ''}</Fact>
        {isOwner && p.clientId && (
          <Fact label="Client portal">
            {p.portalVisible === false ? <span className="text-muted-foreground">Hidden</span> : 'Visible to client'}
          </Fact>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function StaffMilestones({ project: p }: { project: ProjectRow }) {
  if (!p.milestones?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestones</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {p.milestones.length === 0 ? (
          <EmptyState title="No milestones" />
        ) : (
          <ul className="divide-y">
            {p.milestones.map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span>{m.name}</span>
                <span className="flex items-center gap-2">
                  {m.dueDate && <span className="text-xs text-muted-foreground">{formatDate(m.dueDate)}</span>}
                  <StatusBadge status={m.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
