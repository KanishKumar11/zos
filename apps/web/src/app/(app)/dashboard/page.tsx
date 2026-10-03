// Dashboard — one home per role: owner command centre, admin/lead team pulse, member "my day".
'use client';

import { Role } from '@agency/shared';

import { useAuthStore } from '@/store/auth.store';

import { MemberHome } from './member-home';
import { OwnerHome } from './owner-home';
import { TeamPulse } from './team-pulse';

export default function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === Role.OWNER) return <OwnerHome />;
  if (role === Role.ADMIN || role === Role.LEAD) return <TeamPulse />;
  return <MemberHome />;
}
