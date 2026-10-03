// Team faces — avatars for the people on a project. Project responses carry each member's name;
// the staff directory (owner, admin, lead) and the viewer's own name are fallbacks for older data.
// A face with no known name shows without initials rather than as "?".
'use client';

import { useCallback, useMemo } from 'react';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { Avatar } from '@/components/viz';
import { useStaffDirectory } from '@/features/team/team.hooks';

import type { ProjectMemberRow } from '../projects.hooks';

const CAN_BROWSE = new Set<string>([Role.OWNER, Role.ADMIN, Role.LEAD]);

/** Resolve a project member's display name (undefined when the viewer can't know it). */
export function usePeopleNames() {
  const me = useAuthStore((s) => s.user);
  const staff = useStaffDirectory({ enabled: !!me && CAN_BROWSE.has(me.role) });
  const map = useMemo(() => new Map((staff.data ?? []).map((u) => [u._id, u.name])), [staff.data]);
  return useCallback(
    (m: Pick<ProjectMemberRow, 'userId' | 'name'>): string | undefined =>
      m.name ?? map.get(m.userId) ?? (m.userId === me?.id ? me?.name : undefined),
    [map, me],
  );
}

const SIZE = { xs: 'h-5 w-5', sm: 'h-7 w-7', md: 'h-9 w-9' } as const;

export function TeamFaces({
  members,
  max = 4,
  size = 'sm',
  className,
}: {
  members: Pick<ProjectMemberRow, 'userId' | 'name'>[];
  max?: number;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const nameOf = usePeopleNames();
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  if (members.length === 0) return <span className={cn('text-xs text-muted-foreground', className)}>No one yet</span>;
  return (
    <span className={cn('inline-flex items-center -space-x-2', className)} aria-label={`${members.length} ${members.length === 1 ? 'person' : 'people'} on this project`}>
      {shown.map((m) => {
        const name = nameOf(m);
        return name ? (
          <Avatar key={m.userId} id={m.userId} name={name} size={size} ring />
        ) : (
          <span
            key={m.userId}
            className={cn('inline-block shrink-0 rounded-full ring-2 ring-background', SIZE[size])}
            style={{ background: identityColor(m.userId) }}
            title="Teammate"
            aria-hidden
          />
        );
      })}
      {extra > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background', SIZE[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}
