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
  const hidden = p.portalVisible === false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client view"
        description="What the client's portal users see for this project."
        crumbs={[{ label: 'Projects', href: '/projects' }, { label: p.name ?? 'Project', href: `/projects/${id}` }]}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${id}`}>Back to project</Link>
          </Button>
        }
      />
      <div
        className={
          hidden || p.noClient
            ? 'flex items-start gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm'
            : 'flex items-start gap-3 rounded-[var(--radius)] border border-info/30 bg-info/10 px-4 py-3 text-sm'
        }
      >
        {hidden || p.noClient ? <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <Eye className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
        <span className="flex-1">
          {p.noClient
            ? 'This project has no client, so nobody sees it in the portal.'
            : hidden
              ? 'This project is hidden from the client portal. This is what they would see if you showed it.'
              : "This is exactly what the client's portal users see. Only updates and files marked “Share with client” appear, and the team is shown by name only — never their pay."}
        </span>
      </div>
      {p.noClient ? (
        <EmptyState illustration="people" title="No client linked" description="Link a client in Edit project to use the portal." />
      ) : (
        <div className="rounded-[calc(var(--radius)+6px)] border border-dashed bg-background p-3 sm:p-5 md:p-6">
          <PortalProjectView project={p} preview />
        </div>
      )}
    </div>
  );
}
