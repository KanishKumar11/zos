// Owner preview — a project exactly as the client's portal users see it.
'use client';

import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { PortalProjectView } from '@/features/portal/portal-project-view';
import { usePortalPreview } from '@/features/portal/portal.hooks';

export default function PortalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const preview = usePortalPreview(id);
  if (preview.isLoading) return <PageSkeleton />;
  if (preview.isError || !preview.data) return <ErrorState error={preview.error} onRetry={() => preview.refetch()} />;
  const p = preview.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Client view" crumbs={[{ label: 'Projects', href: '/projects' }, { label: p.name ?? 'Project', href: `/projects/${id}` }]} />
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-600/30 bg-sky-600/5 px-4 py-3 text-sm">
        {p.portalVisible === false ? <EyeOff className="h-4 w-4 text-amber-600" /> : <Eye className="h-4 w-4 text-sky-700" />}
        <span className="flex-1">
          {p.noClient
            ? 'This project has no client, so nobody sees it in the portal.'
            : p.portalVisible === false
              ? 'This project is hidden from the client portal. This is what they would see if you showed it.'
              : "This is exactly what the client's portal users see. Only updates and files marked “Share with client” appear."}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${id}`}>Back to project</Link>
        </Button>
      </div>
      {p.noClient ? (
        <EmptyState title="No client linked" description="Link a client in Edit project to use the portal." />
      ) : (
        <div className="rounded-xl border bg-background p-4 shadow-sm md:p-6">
          <PortalProjectView project={p} preview />
        </div>
      )}
    </div>
  );
}
