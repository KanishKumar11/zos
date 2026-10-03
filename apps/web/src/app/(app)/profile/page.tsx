// My profile — every team member's own details, bank details for payouts, and password.
'use client';

import type { ReactNode } from 'react';

import { usePageTitle } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, PrivacyChip } from '@/components/viz';
import { BankDetailsCard, ChangePasswordCard, ProfileDetailsCard } from '@/features/account/account-forms';
import { tenureLabel } from '@/features/team/people';
import { ROLE_LABEL } from '@/features/team/team.api';
import { useMyProfile } from '@/features/team/team.hooks';

export default function ProfilePage() {
  usePageTitle('My profile');
  const me = useMyProfile();
  const u = me.data;
  const tenure = tenureLabel(u?.dateOfJoining);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {u ? (
            <Avatar id={u._id} name={u.name} className="h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl" />
          ) : (
            <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
          )}
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">My profile</p>
            {u ? (
              <h1 className="truncate font-display text-[1.9rem] font-bold leading-tight sm:text-[2.3rem]">{u.name}</h1>
            ) : (
              <Skeleton className="mt-1 h-9 w-56" />
            )}
            {u && (
              <p className="text-sm text-muted-foreground">
                {ROLE_LABEL[u.role] ?? u.role}
                {tenure ? ` · with us ${tenure}` : ''}
              </p>
            )}
          </div>
        </div>
        <PrivacyChip>Bank details: only you and the owner</PrivacyChip>
      </header>

      <Group title="You" blurb="How you appear across the workspace.">
        <ProfileDetailsCard />
      </Group>
      <Group title="Getting paid" blurb="Where your payments go. Stored encrypted.">
        <BankDetailsCard />
      </Group>
      <Group title="Security" blurb="Keep your account yours.">
        <ChangePasswordCard />
      </Group>
    </div>
  );
}

function Group({ title, blurb, children }: { title: string; blurb: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  );
}
