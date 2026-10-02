// Notifications inbox — shared by the workspace and the client portal.
'use client';

import { BellOff, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useMarkAllRead, useMarkRead, useNotifications } from './notifications.hooks';

const TYPE_LABEL: Record<string, string> = {
  TASK_ASSIGNED: 'Task',
  TASK_COMMENTED: 'Comment',
  TASK_MENTIONED: 'Mention',
  PAYSLIP_GENERATED: 'Payslip',
  PAYMENT_RECEIVED: 'Payment',
  ANNOUNCEMENT_POSTED: 'Announcement',
  MILESTONE_RECEIVED: 'Milestone',
  INVOICE_OVERDUE: 'Invoice',
  INVOICE_SENT: 'Invoice',
  PROJECT_UPDATE: 'Project update',
  LEAVE_REQUESTED: 'Leave',
  LEAVE_APPROVED: 'Leave',
  LEAVE_REJECTED: 'Leave',
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

export function NotificationsInbox() {
  const inbox = useNotifications();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const items = (inbox.data ?? []).filter((n) => (filter === 'unread' ? !n.readAt : true));
  const unread = (inbox.data ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        action={
          <Button variant="outline" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Mark all read
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unread ? ` (${unread})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="rounded-lg border bg-card">
        {inbox.isLoading ? (
          <TableSkeleton rows={5} columns={2} />
        ) : inbox.isError ? (
          <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={BellOff} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n._id}>
                <div
                  role={n.linkPath ? 'button' : undefined}
                  tabIndex={n.linkPath ? 0 : undefined}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate([n._id]);
                    if (n.linkPath) router.push(n.linkPath);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && n.linkPath) {
                      if (!n.readAt) markRead.mutate([n._id]);
                      router.push(n.linkPath);
                    }
                  }}
                  className={cn('flex items-start gap-3 px-5 py-3.5 transition-colors', n.linkPath && 'cursor-pointer hover:bg-muted/30')}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[13px] leading-snug', !n.readAt && 'font-medium')}>{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {TYPE_LABEL[n.type] ?? 'Notice'} · {relative(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      title="Mark as read"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate([n._id]);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
