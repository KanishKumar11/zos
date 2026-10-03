// Portal projects — every project we're doing together, with how far along each one is.
'use client';

import { ArrowRight, CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { identityColor } from '@/lib/identity';

import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Avatar, Bento, HealthRing, Hero, HeroFigure, Tile } from '@/components/viz';
import { usePortalProjects, type PortalProjectSummary } from '@/features/portal/portal.hooks';
import { isFinished, journeyOf, plainProjectStatus, progressOf, shortDate } from '@/features/portal/portal-ui';

export default function PortalProjects() {
  const projects = usePortalProjects();
  const list = projects.data ?? [];
  const active = list.filter((p) => !isFinished(p.status));
  const finished = list.filter((p) => isFinished(p.status));

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="Projects"
        loading={projects.isLoading}
        lede={list.length > 0 ? 'Open a project to see each step, updates from the team, shared files and milestones.' : undefined}
      >
        {list.length === 0 ? (
          <>Everything we work on together will live here.</>
        ) : active.length === 0 ? (
          <>
            All <HeroFigure>{list.length}</HeroFigure> of our projects together are finished.
          </>
        ) : (
          <>
            <HeroFigure>{active.length}</HeroFigure> project{active.length === 1 ? ' is' : 's are'} in progress
            {finished.length > 0 ? <>, and {finished.length} finished</> : null}.
          </>
        )}
      </Hero>

      {projects.isLoading ? (
        <Bento>
          {[0, 1, 2].map((i) => (
            <Tile key={i} span={4}>
              <Skeleton className="h-28 w-full" />
            </Tile>
          ))}
        </Bento>
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : list.length === 0 ? (
        <Bento>
          <Tile span={12}>
            <EmptyState
              illustration="projects"
              title="No projects yet"
              description="As soon as we kick off, your project shows up here with its steps and updates."
            />
          </Tile>
        </Bento>
      ) : (
        <>
          {active.length > 0 && (
            <Bento>
              {active.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </Bento>
          )}
          {finished.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[13px] font-semibold text-muted-foreground">Finished</h2>
              <Bento>
                {finished.map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </Bento>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project: p }: { project: PortalProjectSummary }) {
  const ms = p.milestones ?? [];
  // Older API responses only carry counts; fall back to them.
  const pct = ms.length ? progressOf(ms).pct : p.milestoneCount ? Math.round((p.milestonesDone / p.milestoneCount) * 100) : isFinished(p.status) ? 100 : 0;
  const next = ms.length ? journeyOf(ms).next : p.nextMilestone;
  const color = identityColor(p._id);
  const hasSteps = ms.length > 0 || p.milestoneCount > 0;

  return (
    <Link
      href={`/portal/projects/${p._id}`}
      className="group col-span-12 flex min-w-0 animate-rise flex-col gap-4 rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25 sm:col-span-6 sm:p-5 lg:col-span-4"
    >
      <div className="flex items-start gap-4">
        <HealthRing
          size={68}
          rings={[{ value: pct / 100, color, label: 'Progress' }]}
          center={<span className="font-display text-sm font-bold">{hasSteps ? `${pct}%` : '—'}</span>}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">{p.name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{plainProjectStatus(p.status)}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
      <div className="mt-auto space-y-1.5 text-[13px]">
        {next ? (
          <p>
            <span className="text-muted-foreground">Next up:</span> <span className="font-medium">{next.name}</span>
            {next.dueDate && <span className="text-muted-foreground"> · {shortDate(next.dueDate)}</span>}
          </p>
        ) : hasSteps ? (
          <p className="text-muted-foreground">Every step reached</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {(p.startDate || p.endDate) && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {p.startDate ? shortDate(p.startDate) : 'Started'} → {p.endDate ? shortDate(p.endDate) : 'ongoing'}
            </span>
          )}
          {p.lead && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={p.lead.name} size="xs" /> {p.lead.name}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
