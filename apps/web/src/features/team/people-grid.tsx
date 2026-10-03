// People grid — the visual view of the team list. One card per person: identity-colour avatar,
// role, department, tenure and (where a checklist exists) an onboarding progress ring. No money.
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { UserStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, HealthRing } from '@/components/viz';

import { onboardingProgress, tenureLabel } from './people';
import { ROLE_LABEL, type UserRow } from './team.api';

export function PeopleGrid({
  people,
  loading,
  error,
  onRetry,
  empty,
  deptLabel,
  desigLabel,
}: {
  people: UserRow[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: ReactNode;
  deptLabel: (u: UserRow) => string | undefined;
  desigLabel: (u: UserRow) => string | undefined;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-[var(--radius)]" />
        ))}
      </div>
    );
  }
  if (error && !people) return <ErrorState title="Couldn't load the team" error={error} onRetry={onRetry} className="rounded-[var(--radius)] border bg-card" />;
  if (!people || people.length === 0) return <div className="rounded-[var(--radius)] border bg-card">{empty}</div>;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {people.map((u) => (
        <li key={u._id} className="min-w-0">
          <PersonCard user={u} dept={deptLabel(u)} desig={desigLabel(u)} />
        </li>
      ))}
    </ul>
  );
}

function PersonCard({ user: u, dept, desig }: { user: UserRow; dept?: string; desig?: string }) {
  const progress = onboardingProgress(u);
  const tenure = tenureLabel(u.dateOfJoining);
  const inactive = u.status === UserStatus.SUSPENDED || u.status === UserStatus.EXITED;
  const finished = progress && progress.done === progress.total;
  return (
    <Link
      href={`/team/${u._id}`}
      className={cn(
        'group flex h-full animate-rise flex-col rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25',
        inactive && 'opacity-60',
      )}
    >
      {/* Identity strip in the person's colour */}
      <div className="-mx-4 -mt-4 mb-3 h-1.5 rounded-t-[var(--radius)]" style={{ background: identityColor(u._id, 0.85) }} aria-hidden />
      <div className="flex items-start gap-3">
        {progress ? (
          <HealthRing
            size={60}
            rings={[{ value: progress.pct, color: finished ? 'hsl(var(--success))' : identityColor(u._id), label: 'Onboarding' }]}
            center={<Avatar id={u._id} name={u.name} size="lg" className="h-10 w-10" />}
          />
        ) : (
          <Avatar id={u._id} name={u.name} size="lg" className="h-[60px] w-[60px] text-base" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate font-display text-[17px] font-bold leading-tight group-hover:underline">{u.name}</p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
            {u.status !== UserStatus.ACTIVE && <StatusBadge status={u.status} />}
          </div>
        </div>
      </div>
      <dl className="mb-3 mt-4 grid gap-1.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Department</dt>
          <dd className="min-w-0 truncate text-right">{dept ?? <span className="text-muted-foreground">Not set</span>}</dd>
        </div>
        {desig && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Designation</dt>
            <dd className="min-w-0 truncate text-right">{desig}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">With us</dt>
          <dd className="text-right">{tenure ?? <span className="text-muted-foreground">No joining date</span>}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>{progress ? (finished ? 'Onboarding done' : `Onboarding ${progress.done} of ${progress.total}`) : 'No onboarding checklist'}</span>
        <span className="truncate">{u.lastLoginAt ? `Seen ${formatDate(u.lastLoginAt, { day: 'numeric', month: 'short' })}` : 'Never signed in'}</span>
      </div>
    </Link>
  );
}
