// Who was paid the most — team vs freelancers split, then one bar per person stacked by project
// (project identity colours). OWNER only; every amount goes through <Price>, and tooltip strings
// are built only when the viewer may see prices.
'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { PayeeType } from '@agency/shared';

import { identityColor } from '@/lib/identity';

import { Avatar, formatCompact, Legend, Price, SegmentBar, useCanSeePrices } from '@/components/viz';

import { payeeHref, payeeIdOf } from './payout-timeline';
import type { PayoutRow } from './payouts.hooks';

const TEAM_COLOR = 'hsl(var(--primary))';
const FREELANCER_COLOR = 'hsl(var(--info))';

interface PersonTotal {
  key: string;
  id: string;
  name: string;
  type: PayeeType;
  href?: string;
  totalPaise: number;
  count: number;
  projects: { key: string; name: string; amountPaise: number }[];
}

export function PayeeBars({ rows, max = 8 }: { rows: PayoutRow[]; max?: number }) {
  const canSee = useCanSeePrices();
  const { people, teamPaise, freelancerPaise } = useMemo(() => {
    const map = new Map<string, PersonTotal & { byProject: Map<string, { key: string; name: string; amountPaise: number }> }>();
    let team = 0;
    let fl = 0;
    for (const r of rows) {
      if (r.payeeType === PayeeType.FREELANCER) fl += r.amountPaise;
      else team += r.amountPaise;
      const id = payeeIdOf(r);
      const key = `${r.payeeType}:${id || r.payeeName}`;
      let p = map.get(key);
      if (!p) {
        p = { key, id, name: r.payeeName, type: r.payeeType, href: payeeHref(r), totalPaise: 0, count: 0, projects: [], byProject: new Map() };
        map.set(key, p);
      }
      p.totalPaise += r.amountPaise;
      p.count += 1;
      const projKey = r.projectId ?? 'general';
      const projName = r.projectId ? (r.projectName ?? 'Deleted project') : 'General';
      const proj = p.byProject.get(projKey) ?? { key: projKey, name: projName, amountPaise: 0 };
      proj.amountPaise += r.amountPaise;
      p.byProject.set(projKey, proj);
    }
    const list = [...map.values()]
      .map(({ byProject, ...rest }) => ({ ...rest, projects: [...byProject.values()].sort((a, b) => b.amountPaise - a.amountPaise) }))
      .sort((a, b) => b.totalPaise - a.totalPaise);
    return { people: list, teamPaise: team, freelancerPaise: fl };
  }, [rows]);

  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const top = Math.max(1, shown[0]?.totalPaise ?? 1);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SegmentBar
          height="h-7"
          segments={[
            { value: teamPaise, color: TEAM_COLOR, label: 'Team', display: canSee ? formatCompact(teamPaise) : '' },
            { value: freelancerPaise, color: FREELANCER_COLOR, label: 'Freelancers', display: canSee ? formatCompact(freelancerPaise) : '' },
          ]}
        />
        <Legend
          items={[
            { color: TEAM_COLOR, label: <>Team <Price paise={teamPaise} compact className="text-foreground" /></> },
            { color: FREELANCER_COLOR, label: <>Freelancers <Price paise={freelancerPaise} compact className="text-foreground" /></> },
          ]}
        />
      </div>

      <ol className="space-y-3">
        {shown.map((p) => (
          <li key={p.key} className="min-w-0">
            <div className="flex items-center gap-2 text-[13px]">
              <Avatar id={p.id || undefined} name={p.name} size="xs" />
              {p.href ? (
                <Link href={p.href} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {p.name}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              )}
              {p.type === PayeeType.FREELANCER && <span className="shrink-0 text-[11px] text-muted-foreground">Freelancer</span>}
              <Price paise={p.totalPaise} compact className="shrink-0 font-semibold" />
            </div>
            <div
              className="mt-1.5 flex h-2.5 gap-px overflow-hidden rounded-full"
              style={{ width: `${Math.max(6, (p.totalPaise / top) * 100)}%` }}
              role="img"
              aria-label={`${p.name}: ${p.count} payment${p.count === 1 ? '' : 's'} across ${p.projects.length} project${p.projects.length === 1 ? '' : 's'}`}
            >
              {p.projects.map((proj) => (
                <span
                  key={proj.key}
                  className="h-full"
                  style={{
                    flex: proj.amountPaise,
                    background: proj.key === 'general' ? 'hsl(var(--muted-foreground) / 0.45)' : identityColor(proj.key),
                  }}
                  title={canSee ? `${proj.name}: ${formatCompact(proj.amountPaise)}` : proj.name}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {people.length > shown.length && (
        <p className="text-xs text-muted-foreground">
          And {people.length - shown.length} more {people.length - shown.length === 1 ? 'person' : 'people'}.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Each bar is split by project.</p>
    </div>
  );
}
