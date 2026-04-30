// Notifications inbox page.
'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useMarkAllRead, useNotifications } from '@/features/notifications/notifications.hooks';

export default function NotificationsPage() {
  const inbox = useNotifications();
  const markAll = useMarkAllRead();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button variant="ghost" onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {inbox.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : inbox.data && inbox.data.length > 0 ? (
            <ul className="divide-y">
              {inbox.data.map((n) => (
                <li key={n._id} className={`py-3 ${n.readAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()} · {n.type}
                      </p>
                    </div>
                    {n.linkPath && (
                      <Link className="text-sm underline" href={n.linkPath}>
                        Open
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
