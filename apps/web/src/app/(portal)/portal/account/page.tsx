'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/viz';
import { ChangePasswordCard, ProfileDetailsCard } from '@/features/account/account-forms';
import { usePortalMe } from '@/features/portal/portal.hooks';

export default function PortalAccount() {
  const me = usePortalMe();
  const colleagues = me.data?.colleagues ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Account"
        eyebrow={me.data ? `${me.data.client.name} · client portal` : undefined}
        description={me.data ? `Signed in as ${me.data.user.email}` : undefined}
      />
      <ProfileDetailsCard />
      <ChangePasswordCard />
      <Card>
        <CardHeader>
          <CardTitle>Others from {me.data?.client.name ?? 'your company'} with access</CardTitle>
        </CardHeader>
        <CardContent>
          {colleagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Only you so far. Ask us if a colleague needs access.</p>
          ) : (
            <ul className="divide-y text-sm">
              {colleagues.map((c) => (
                <li key={c.email} className="flex items-center gap-3 py-2.5">
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.title && <span className="block truncate text-xs text-muted-foreground">{c.title}</span>}
                  </span>
                  <a href={`mailto:${c.email}`} className="hidden truncate text-muted-foreground hover:text-foreground sm:inline">
                    {c.email}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
