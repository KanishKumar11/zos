// Notifications inbox — shared by the workspace and the client portal. Grouped into Today /
// Yesterday / Earlier, unread items carry a brand rail and stronger type.
'use client';

import {
  AtSign,
  Bell,
  CalendarCheck2,
  Check,
  CheckSquare,
  FolderKanban,
  Megaphone,
  MessageSquare,
  Receipt,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { toLocalDateInput } from '@/lib/form';
import { formatDateTime } from '@/lib/formatters';

import { Hero, HeroFigure } from '@/components/viz';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useMarkAllRead, useMarkRead, useNotifications, type NotificationRow } from './notifications.hooks';

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  TASK_ASSIGNED: { label: 'Task', icon: CheckSquare },
  TASK_COMMENTED: { label: 'Comment', icon: MessageSquare },
  TASK_MENTIONED: { label: 'Mention', icon: AtSign },
  PAYSLIP_GENERATED: { label: 'Payslip', icon: Wallet },
  PAYMENT_RECEIVED: { label: 'Payment', icon: Wallet },
  ANNOUNCEMENT_POSTED: { label: 'Announcement', icon: Megaphone },
  MILESTONE_RECEIVED: { label: 'Milestone', icon: FolderKanban },
  INVOICE_OVERDUE: { label: 'Invoice', icon: Receipt },
  INVOICE_SENT: { label: 'Invoice', icon: Receipt },
  PROJECT_UPDATE: { label: 'Project update', icon: FolderKanban },
  LEAVE_REQUESTED: { label: 'Leave', icon: CalendarCheck2 },
  LEAVE_APPROVED: { label: 'Leave', icon: CalendarCheck2 },
  LEAVE_REJECTED: { label: 'Leave', icon: CalendarCheck2 },
};

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDateTime(iso);
}

type Group = 'Today' | 'Yesterday' | 'Earlier';

function groupOf(iso: string, today: string, yesterday: string): Group {
  const key = toLocalDateInput(new Date(iso));
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return 'Earlier';
}

export function NotificationsInbox() {
  const inbox = useNotifications();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const items = (inbox.data ?? []).filter((n) => (filter === 'unread' ? !n.readAt : true));
  const unread = (inbox.data ?? []).filter((n) => !n.readAt).length;

  const groups = useMemo(() => {
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const today = toLocalDateInput(now);
    const yesterday = toLocalDateInput(y);
    const out: Record<Group, NotificationRow[]> = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of items) out[groupOf(n.createdAt, today, yesterday)].push(n);
    return (['Today', 'Yesterday', 'Earlier'] as Group[]).map((g) => ({ g, rows: out[g] })).filter((x) => x.rows.length > 0);
  }, [items]);

  const open = (n: NotificationRow) => {
    if (!n.readAt) markRead.mutate([n._id]);
    if (n.linkPath) router.push(n.linkPath);
  };

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Notifications"
        loading={inbox.isLoading}
        aside={
          <Button variant="outline" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> {markAll.isPending ? 'Marking…' : 'Mark all read'}
          </Button>
        }
      >
        {inbox.isError ? (
          <>Your notifications.</>
        ) : unread ? (
          <>
            <HeroFigure>{unread} unread</HeroFigure> {unread === 1 ? 'notification is' : 'notifications are'} waiting for you.
          </>
        ) : (
          <>You&apos;re all caught up.</>
        )}
      </Hero>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unread ? ` (${unread})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      {inbox.isLoading ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <TableSkeleton rows={5} columns={2} />
        </div>
      ) : inbox.isError ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <EmptyState
            illustration={filter === 'unread' ? 'done' : 'inbox'}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={filter === 'unread' ? 'Everything has been read.' : 'Task assignments, mentions and updates will land here.'}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ g, rows }) => {
            const groupUnread = rows.filter((n) => !n.readAt).length;
            return (
              <section key={g} className="animate-rise">
                <h2 className="mb-2 flex items-baseline gap-2 px-1">
                  <span className="font-display text-lg font-bold">{g}</span>
                  {groupUnread > 0 && <span className="text-xs font-medium text-brand-ink">{groupUnread} unread</span>}
                </h2>
                <ul className="divide-y overflow-hidden rounded-[var(--radius)] border bg-card">
                  {rows.map((n) => {
                    const meta = TYPE_META[n.type] ?? { label: 'Notice', icon: Bell };
                    const Icon = meta.icon;
                    const isUnread = !n.readAt;
                    return (
                      <li key={n._id} className="relative">
                        {isUnread && <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden />}
                        <div
                          role={n.linkPath ? 'button' : undefined}
                          tabIndex={n.linkPath ? 0 : undefined}
                          onClick={() => open(n)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && n.linkPath) {
                              e.preventDefault();
                              open(n);
                            }
                          }}
                          className={cn(
                            'flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5',
                            isUnread && 'bg-brand-wash/40',
                            n.linkPath && 'cursor-pointer hover:bg-muted/40',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
                              isUnread ? 'bg-brand text-primary-foreground' : 'bg-muted text-muted-foreground',
                            )}
                            aria-hidden
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm leading-snug', isUnread ? 'font-semibold' : 'text-foreground/80')}>{n.title}</p>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{n.body}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {meta.label} · {relative(n.createdAt)}
                              {isUnread && <span className="sr-only"> · unread</span>}
                            </p>
                          </div>
                          {isUnread && (
                            <button
                              type="button"
                              aria-label="Mark as read"
                              title="Mark as read"
                              disabled={markRead.isPending && markRead.variables?.includes(n._id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead.mutate([n._id]);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
