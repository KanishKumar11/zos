// Notifications inbox page.
'use client';

import Link from 'next/link';
import { BellOff } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { useMarkAllRead, useMarkRead, useNotifications } from '@/features/notifications/notifications.hooks';

export default function NotificationsPage() {
  const inbox = useNotifications();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Your activity and mentions."
        action={
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        {inbox.isLoading ? (
          <div className="flex flex-col divide-y">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : inbox.data && inbox.data.length > 0 ? (
          <ul className="divide-y">
            {inbox.data.map((n) => (
              <li
                key={n._id}
                className={cn(
                  'flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/30',
                  n.readAt && 'opacity-50',
                )}
              >
                {/* Unread indicator */}
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {new Date(n.createdAt).toLocaleString()} · {n.type}
                  </p>
                </div>
                {n.linkPath && (
                  <Link
                    className="shrink-0 text-[12px] font-medium text-primary hover:underline"
                    href={n.linkPath}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate([n._id]);
                    }}
                  >
                    View
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        )}
      </div>
    </div>
  );
}
