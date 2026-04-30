// RoleGate — UI guard. Shows children only if current user role is in allowed list.
'use client';

import type { ReactNode } from 'react';

import type { Role } from '@agency/shared';

import { useAuthStore } from '@/store/auth.store';

export function RoleGate({
  allow,
  fallback = null,
  children,
}: {
  allow: readonly Role[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
