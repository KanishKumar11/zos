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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (error && !people) return <ErrorState title="Couldn't load the team" error={error} onRetry={onRetry} className="rounded-2xl border border-border/80 bg-card p-6" />;
  if (!people || people.length === 0) return <div className="rounded-2xl border border-border/80 bg-card p-6">{empty}</div>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        'group relative flex h-full animate-rise flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm p-5 shadow-xs outline-none transition-all duration-200 hover:border-foreground/30 hover:shadow-xl hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring',
        inactive && 'opacity-60',
      )}
    >
      {/* Identity strip in the person's colour */}
      <span className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{ background: identityColor(u._id, 0.85) }} aria-hidden />
      <div className="flex items-start gap-3.5 pt-1">
        {progress ? (
          <HealthRing
            size={60}
            rings={[{ value: progress.pct, color: finished ? 'hsl(var(--success))' : identityColor(u._id), label: 'Onboarding' }]}
            center={<Avatar id={u._id} name={u.name} size="lg" className="h-10 w-10 ring-2 ring-background" />}
          />
        ) : (
          <Avatar id={u._id} name={u.name} size="lg" className="h-[60px] w-[60px] text-base ring-2 ring-background" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate font-display text-[17px] font-bold leading-tight transition-colors group-hover:text-primary">{u.name}</p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
            {u.status !== UserStatus.ACTIVE && <StatusBadge status={u.status} />}
          </div>
        </div>
      </div>
      <dl className="mb-3 mt-4 grid gap-1.5 border-t border-border/50 pt-3 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Department</dt>
          <dd className="min-w-0 truncate text-right font-medium">{dept ?? <span className="text-muted-foreground font-normal">Not set</span>}</dd>
        </div>
        {desig && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Designation</dt>
            <dd className="min-w-0 truncate text-right font-medium">{desig}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">With us</dt>
          <dd className="text-right font-figures">{tenure ?? <span className="text-muted-foreground">No joining date</span>}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="truncate">{progress ? (finished ? 'Onboarding done' : `Onboarding ${progress.done}/${progress.total}`) : 'No onboarding checklist'}</span>
        <span className="shrink-0">{u.lastLoginAt ? `Seen ${formatDate(u.lastLoginAt, { day: 'numeric', month: 'short' })}` : 'Never signed in'}</span>
      </div>
    </Link>
  );
}
