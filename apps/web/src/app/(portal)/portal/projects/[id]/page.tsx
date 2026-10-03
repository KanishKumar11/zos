'use client';

import { ArrowLeft } from 'lucide-react';
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

  const back = (
    <Link href="/portal/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> All projects
    </Link>
  );

  if (project.isLoading) return <PageSkeleton />;
  if (project.isError || !project.data) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState title="Couldn't open this project" error={project.error} onRetry={() => project.refetch()} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {back}
      <PortalProjectView project={project.data} />
    </div>
  );
}
