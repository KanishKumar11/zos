// Portal overview — the client's at-a-glance page: where each project is, what's due, what's new.
'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { formatDateTime } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';

import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  ActivityTimeline,
  Bento,
  BigNumber,
  Hero,
  HeroFigure,
  HeroMark,
  MilestoneJourney,
  Price,
  PrivacyChip,
  ProjectChip,
  Tile,
} from '@/components/viz';
import { usePortalMe, usePortalProjects, usePortalSummary, type PortalProjectSummary } from '@/features/portal/portal.hooks';
import {
  BalanceMeter,
  ContactList,
  FileCards,
  isFinished,
  journeyOf,
  plainProjectStatus,
  progressOf,
  shortDate,
  useOpenPortalFile,
} from '@/features/portal/portal-ui';

const MAX_JOURNEYS = 3;

export default function PortalOverview() {
  const me = usePortalMe();
  const summary = usePortalSummary();
  const projects = usePortalProjects();
  const openFile = useOpenPortalFile();

  const clientName = me.data?.client.name;
  const firstName = me.data?.user.name?.split(' ')[0];
  const loading = summary.isLoading || projects.isLoading;

  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;

  const s = summary.data;
  const list = projects.data ?? [];
  const active = list.filter((p) => !isFinished(p.status));
  // Lead with the project that has a clear next step.
  const focus = active.find((p) => (p.milestones ?? []).some((m) => m.status === 'PENDING')) ?? active[0];
  const due = s ? Math.max(0, s.outstandingPaise - s.overduePaise) : 0;

  // One contact per distinct lead across active projects.
  const contacts = [...new Map(active.filter((p) => p.lead).map((p) => [p.lead!.email, p])).values()].map((p) => ({
    name: p.lead!.name,
    email: p.lead!.email,
    title: p.lead!.title,
    note: active.length > 1 ? `Leads ${p.name}` : undefined,
  }));

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="Overview"
        loading={loading}
        eyebrow={clientName ? `${clientName} · client portal` : 'Client portal'}
        aside={clientName ? <PrivacyChip>Only {clientName}&rsquo;s own projects and invoices</PrivacyChip> : undefined}
        lede={s && <MoneyLede s={s} />}
      >
        <HeroSentence firstName={firstName} focus={focus} activeCount={active.length} totalCount={list.length} />
      </Hero>

      <Bento>
        {/* Journeys — one per active project */}
        {projects.isLoading ? (
          <Tile span={12} title="Project journey">
            <Skeleton className="h-16 w-full" />
          </Tile>
        ) : projects.isError ? (
          <Tile span={12} title="Project journey">
            <ErrorState error={projects.error} onRetry={() => projects.refetch()} className="py-6" />
          </Tile>
        ) : list.length === 0 ? (
          <Tile span={12}>
            <EmptyState
              illustration="projects"
              title="Your projects will appear here"
              description="As soon as we kick off, you'll see each step, updates from the team and shared files right here."
            />
          </Tile>
        ) : active.length === 0 ? (
          <Tile span={12} title="Your projects">
            <EmptyState
              illustration="done"
              title="Everything we've worked on is finished"
              description="Thank you for working with us. Past projects and their files are always here."
              action={
                <Link href="/portal/projects" className="text-sm font-medium text-brand hover:underline">
                  See past projects
                </Link>
              }
              className="py-6"
            />
          </Tile>
        ) : (
          active.slice(0, MAX_JOURNEYS).map((p) => <JourneyTile key={p._id} project={p} />)
        )}
        {active.length > MAX_JOURNEYS && (
          <Tile span={12} bodyClassName="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              And {active.length - MAX_JOURNEYS} more project{active.length - MAX_JOURNEYS === 1 ? '' : 's'} in progress.
            </span>
            <Link href="/portal/projects" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              All projects <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Tile>
        )}

        {/* Story feed */}
        <Tile span={7} title="Latest from the team" className="lg:row-span-2">
          {summary.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <ActivityTimeline
              items={(s?.recentUpdates ?? []).map((u) => ({
                key: u._id,
                date: u.createdAt,
                color: identityColor(u.projectId),
                title: (
                  <Link href={`/portal/projects/${u.projectId}`} className="font-display text-base font-bold hover:underline">
                    {u.title}
                  </Link>
                ),
                meta: (
                  <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    {u.projectName && list.length > 1 && (
                      <>
                        <ProjectChip id={u.projectId} name={u.projectName} />
                        <span aria-hidden>·</span>
                      </>
                    )}
                    {u.authorName} · {formatDateTime(u.createdAt)}
                  </span>
                ),
                body: (
                  <div className="space-y-2">
                    <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{u.body}</p>
                    <FileCards files={u.files} compact onOpen={(fileId) => void openFile(u.projectId, fileId)} />
                  </div>
                ),
              }))}
              empty={
                <EmptyState
                  illustration="inbox"
                  title="No updates yet"
                  description="When the team shares progress, it shows up here like a story."
                  className="py-8"
                />
              }
            />
          )}
        </Tile>

        {/* Amount due */}
        <Tile
          span={5}
          title="Amount due"
          action={
            <Link href="/portal/invoices" className="text-xs font-medium text-brand hover:underline">
              Invoices
            </Link>
          }
        >
          {!s ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="space-y-4">
              <BigNumber caption={s.outstandingPaise > 0 ? undefined : 'Nothing to pay right now. Thank you!'}>
                <Price paise={s.outstandingPaise} />
              </BigNumber>
              <BalanceMeter paidPaise={s.paidThisFyPaise} duePaise={due} overduePaise={s.overduePaise} paidLabel="Paid this year" />
              {s.overduePaise > 0 && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
                  <Price paise={s.overduePaise} /> is past its due date across {s.overdueCount} invoice{s.overdueCount === 1 ? '' : 's'}. If
                  you&rsquo;ve already paid, thank you — it can take a day or two to show here.
                </p>
              )}
              {s.nextDue && (
                <Link href={`/portal/invoices/${s.nextDue.invoiceId}`} className="block text-[13px] text-muted-foreground hover:text-foreground">
                  Next: invoice <span className="font-figures">{s.nextDue.number}</span> · <Price paise={s.nextDue.balancePaise} currency={s.nextDue.currency} />{' '}
                  due {shortDate(s.nextDue.dueDate)}
                </Link>
              )}
            </div>
          )}
        </Tile>

        {/* Contact */}
        <Tile span={5} title={contacts.length > 1 ? 'Your contacts' : 'Your contact'}>
          {projects.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              We&rsquo;ll introduce your project lead here once your project starts. Until then, just reply to any email from us.
            </p>
          ) : (
            <ContactList people={contacts} />
          )}
        </Tile>
      </Bento>
    </div>
  );
}

function HeroSentence({
  firstName,
  focus,
  activeCount,
  totalCount,
}: {
  firstName?: string;
  focus?: PortalProjectSummary;
  activeCount: number;
  totalCount: number;
}) {
  const hi = firstName ? `Hi ${firstName}. ` : '';
  if (totalCount === 0) return <>{hi}Welcome — your first project will appear here soon.</>;
  if (!focus) return <>{hi}All your projects with us are finished. Thank you!</>;
  const ms = focus.milestones ?? [];
  const { pct } = progressOf(ms);
  const { next } = journeyOf(ms);
  const more = activeCount > 1 ? ` (and ${activeCount - 1} more)` : '';
  if (ms.length === 0) {
    return (
      <>
        {hi}
        <HeroMark>{focus.name}</HeroMark> is {plainProjectStatus(focus.status).toLowerCase()}
        {more}.
      </>
    );
  }
  if (!next) {
    return (
      <>
        {hi}
        <HeroMark>{focus.name}</HeroMark> has reached every step{more}.
      </>
    );
  }
  return (
    <>
      Your <HeroMark>{focus.name}</HeroMark> is <HeroFigure>{pct}%</HeroFigure> there — next up: {next.name}
      {next.dueDate ? ` on ${shortDate(next.dueDate)}` : ''}.
    </>
  );
}

function MoneyLede({ s }: { s: NonNullable<ReturnType<typeof usePortalSummary>['data']> }) {
  if (s.outstandingPaise <= 0) return <>Nothing is due right now — you&rsquo;re all paid up.</>;
  if (s.overduePaise > 0) {
    return (
      <>
        <Price paise={s.outstandingPaise} /> is due, and <Price paise={s.overduePaise} /> of it has passed its due date.
      </>
    );
  }
  return (
    <>
      <Price paise={s.outstandingPaise} /> is due
      {s.nextDue ? (
        <>
          {' '}
          — the next payment by {shortDate(s.nextDue.dueDate)}.
        </>
      ) : (
        '.'
      )}
    </>
  );
}

function JourneyTile({ project: p }: { project: PortalProjectSummary }) {
  const ms = p.milestones ?? [];
  const { pct } = progressOf(ms);
  const { steps, next } = journeyOf(ms, p._id);
  return (
    <Tile
      span={12}
      title={
        <span className="inline-flex min-w-0 items-center gap-1.5">
          Project journey · <ProjectChip id={p._id} name={p.name} className="text-foreground" />
        </span>
      }
      action={
        <Link href={`/portal/projects/${p._id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          Open project <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {ms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {plainProjectStatus(p.status)}. We&rsquo;ll map out the steps for this project here soon.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl font-bold">{pct}%</span>
            <span className="text-sm text-muted-foreground">
              {next ? (
                <>
                  Next up: <span className="font-medium text-foreground">{next.name}</span>
                  {next.dueDate ? ` · ${shortDate(next.dueDate)}` : ''}
                </>
              ) : (
                'Every step reached'
              )}
            </span>
          </div>
          <MilestoneJourney steps={steps} />
        </div>
      )}
    </Tile>
  );
}
