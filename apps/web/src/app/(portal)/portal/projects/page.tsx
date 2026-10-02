'use client';

import { FolderKanban } from 'lucide-react';
import Link from 'next/link';

import { formatDate } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { usePortalProjects } from '@/features/portal/portal.hooks';

export default function PortalProjects() {
  const projects = usePortalProjects();
  if (projects.isLoading) return <PageSkeleton />;
  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />;
  const list = projects.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Everything we're working on together." />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={FolderKanban} title="No projects yet" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p._id} href={`/portal/projects/${p._id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/25">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.name}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-auto space-y-1.5">
                    {p.milestoneCount > 0 && (
                      <>
                        <ProgressBar value={p.milestonesDone} max={p.milestoneCount} />
                        <p className="text-xs text-muted-foreground">
                          {p.milestonesDone} of {p.milestoneCount} milestones
                          {p.nextMilestone ? ` · next: ${p.nextMilestone.name}` : ''}
                        </p>
                      </>
                    )}
                    {(p.startDate || p.endDate) && (
                      <p className="text-xs text-muted-foreground">
                        {p.startDate ? formatDate(p.startDate) : '—'} → {p.endDate ? formatDate(p.endDate) : 'Ongoing'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
