'use client';

import Link from 'next/link';
import { use, useEffect } from 'react';

import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { PortalProjectView } from '@/features/portal/portal-project-view';
import { usePortalProject } from '@/features/portal/portal.hooks';

export default function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = usePortalProject(id);
  useEffect(() => {
    if (project.data) document.title = `${project.data.name} · Client portal`;
  }, [project.data]);

  if (project.isLoading) return <PageSkeleton />;
  if (project.isError || !project.data) return <ErrorState title="Couldn't open this project" error={project.error} onRetry={() => project.refetch()} />;
  return (
    <div className="space-y-4">
      <Link href="/portal/projects" className="text-sm text-muted-foreground hover:text-foreground">
        ← All projects
      </Link>
      <PortalProjectView project={project.data} />
    </div>
  );
}
