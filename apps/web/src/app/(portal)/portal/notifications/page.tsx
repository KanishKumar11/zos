// Notifications inbox page — the shared inbox, set in a calmer reading width for clients.
'use client';

import { NotificationsInbox } from '@/features/notifications/notifications-inbox';

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <NotificationsInbox />
    </div>
  );
}
