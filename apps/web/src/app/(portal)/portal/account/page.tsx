'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordCard, ProfileDetailsCard } from '@/features/account/account-forms';
import { usePortalMe } from '@/features/portal/portal.hooks';

export default function PortalAccount() {
  const me = usePortalMe();
  const colleagues = me.data?.colleagues ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Account" description={me.data ? `Signed in for ${me.data.client.name}` : undefined} />
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
                <li key={c.email} className="flex justify-between gap-3 py-2">
                  <span>
                    {c.name}
                    {c.title && <span className="text-muted-foreground"> · {c.title}</span>}
                  </span>
                  <span className="text-muted-foreground">{c.email}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
