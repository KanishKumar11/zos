// My profile — every team member's own details, bank details for payouts, and password.
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { BankDetailsCard, ChangePasswordCard, ProfileDetailsCard } from '@/features/account/account-forms';

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My profile" description="Your details, where you get paid, and your password." />
      <ProfileDetailsCard />
      <BankDetailsCard />
      <ChangePasswordCard />
    </div>
  );
}
