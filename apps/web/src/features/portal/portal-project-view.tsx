// The client's view of one project — used by the portal and by the owner's "Preview as client".
// Shows the journey, the team's story feed with files, milestones with their amounts (the client's
// own prices) and who's on the team. Never any team pay.
'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { identityColor } from '@/lib/identity';
import { formatDateTime } from '@/lib/formatters';

import { EmptyState } from '@/components/ui/states';
import { ActivityTimeline, Avatar, AvatarStack, Bento, Legend, MilestoneJourney, Price, SegmentBar, Tile, formatCompact, useCanSeePrices } from '@/components/viz';

import { type PortalProject } from './portal.hooks';
import { ContactList, FileCards, journeyOf, plainProjectStatus, progressOf, shortDate, useOpenPortalFile } from './portal-ui';

const MILESTONE_WORD: Record<string, string> = { PENDING: 'Coming up', INVOICED: 'Done · invoiced', COLLECTED: 'Done · paid' };

export function PortalProjectView({ project: p, preview = false }: { project: PortalProject; preview?: boolean }) {
  const open = useOpenPortalFile(preview);
  const canSee = useCanSeePrices();
  const { pct } = progressOf(p.milestones);
  const { steps, next } = journeyOf(p.milestones, p._id);
  const sum = (status: string) => p.milestones.filter((m) => m.status === status).reduce((s, m) => s + m.amountPaise, 0);
  const paid = sum('COLLECTED');
  const invoiced = sum('INVOICED');
  const upcoming = sum('PENDING');
  const total = paid + invoiced + upcoming;
  const team = p.team ?? (p.lead ? [{ name: p.lead.name, lead: true }] : []);
  const Heading = preview ? 'h2' : 'h1';

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          {plainProjectStatus(p.status)}
          {(p.startDate || p.endDate) && (
            <span className="ml-2 inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {p.startDate ? shortDate(p.startDate) : 'Started'} → {p.endDate ? shortDate(p.endDate) : 'ongoing'}
            </span>
          )}
        </p>
        <Heading className="font-display max-w-[24ch] text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.05]">
          {p.milestones.length === 0 ? (
            p.name
          ) : next ? (
            <>
              {p.name} is <span className="text-brand">{pct}%</span> there.
            </>
          ) : (
            <>
              {p.name} has reached <span className="text-brand">every step</span>.
            </>
          )}
        </Heading>
        {next && (
          <p className="text-[15px] text-muted-foreground">
            Next up: <span className="font-medium text-foreground">{next.name}</span>
            {next.dueDate ? ` on ${shortDate(next.dueDate)}` : ''}.
          </p>
        )}
        {p.description && <p className="max-w-[62ch] text-sm text-muted-foreground">{p.description}</p>}
      </header>

      <Bento>
        <Tile span={12} title="Project journey">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">We&rsquo;ll map out the steps for this project here soon.</p>
          ) : (
            <MilestoneJourney steps={steps} />
          )}
        </Tile>

        <Tile span={7} title="Updates from the team" className="lg:row-span-2">
          <ActivityTimeline
            items={p.updates.map((u) => ({
              key: u._id,
              date: u.createdAt,
              color: identityColor(u.authorName),
              title: <span className="font-display text-base font-bold">{u.title}</span>,
              meta: (
                <>
                  {u.authorName} · {formatDateTime(u.createdAt)}
                  {u.editedAt ? ' · edited' : ''}
                </>
              ),
              body: (
                <div className="space-y-2.5">
                  <p className="whitespace-pre-line text-muted-foreground">{u.body}</p>
                  <FileCards files={u.files} compact onOpen={(fileId) => void open(p._id, fileId)} />
                </div>
              ),
            }))}
            empty={<EmptyState illustration="inbox" title="No updates yet" description="Progress updates from the team will appear here." className="py-8" />}
          />
        </Tile>

        <Tile span={5} title="Milestones">
          {p.milestones.length === 0 ? (
            <EmptyState illustration="calendar" title="No milestones yet" className="py-6" />
          ) : (
            <div className="space-y-4">
              {total > 0 && (
                <div className="space-y-2">
                  <SegmentBar
                    height="h-3"
                    showLabels={false}
                    segments={[
                      { value: paid, color: 'hsl(var(--success))', label: 'Paid', display: canSee ? formatCompact(paid, p.currency) : '' },
                      { value: invoiced, color: 'hsl(var(--primary))', label: 'Invoiced', display: canSee ? formatCompact(invoiced, p.currency) : '' },
                      { value: upcoming, color: 'hsl(var(--muted-foreground) / 0.35)', label: 'Not billed yet', display: canSee ? formatCompact(upcoming, p.currency) : '' },
                    ]}
                  />
                  <Legend
                    items={[
                      { color: 'hsl(var(--success))', label: <>Paid <Price paise={paid} currency={p.currency} compact /></> },
                      { color: 'hsl(var(--primary))', label: <>Invoiced <Price paise={invoiced} currency={p.currency} compact /></> },
                      { color: 'hsl(var(--muted-foreground) / 0.35)', label: <>Not billed yet <Price paise={upcoming} currency={p.currency} compact /></> },
                    ]}
                  />
                </div>
              )}
              <ol className="divide-y">
                {p.milestones.map((m, i) => (
                  <li key={m._id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 font-figures text-[10px] font-semibold',
                        m.status === 'COLLECTED' && 'border-success bg-success text-background',
                        m.status === 'INVOICED' && 'border-brand text-brand',
                        m.status === 'PENDING' && 'text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{m.name}</p>
                        <Price paise={m.amountPaise} currency={p.currency} className="shrink-0" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {MILESTONE_WORD[m.status] ?? 'Coming up'}
                        {m.dueDate ? ` · ${m.status === 'PENDING' ? 'planned for' : 'due'} ${shortDate(m.dueDate)}` : ''}
                        {m.invoice && (
                          <>
                            {' · '}
                            {preview ? (
                              <span className="font-figures">{m.invoice.number}</span>
                            ) : (
                              <Link href={`/portal/invoices/${m.invoice._id}`} className="font-figures text-brand hover:underline">
                                {m.invoice.number}
                              </Link>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Tile>

        <Tile span={5} title="Your team" action={team.length > 1 ? <AvatarStack people={team.map((t) => ({ name: t.name }))} max={5} /> : undefined}>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">We&rsquo;ll introduce the team here once the project starts.</p>
          ) : (
            <div className="space-y-4">
              {p.lead && <ContactList people={[{ name: p.lead.name, email: p.lead.email, note: 'Your main contact' }]} />}
              {team.filter((t) => !t.lead).length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-2.5">
                  {team
                    .filter((t) => !t.lead)
                    .map((t, i) => (
                      <li key={`${t.name}-${i}`} className="flex min-w-0 items-center gap-2 text-[13px]">
                        <Avatar name={t.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{t.name}</span>
                          {t.title && <span className="block truncate text-xs text-muted-foreground">{t.title}</span>}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </Tile>

        <Tile span={12} title="Shared files">
          {p.files.length === 0 ? (
            <EmptyState illustration="files" title="No shared files yet" description="Designs, documents and handovers the team shares will be here to download." className="py-6" />
          ) : (
            <FileCards files={p.files} onOpen={(fileId) => void open(p._id, fileId)} />
          )}
        </Tile>
      </Bento>
    </div>
  );
}
