// Project health wall — one concentric HealthRing per live project, riskiest first. OWNER only.
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { identityColor } from '@/lib/identity';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HealthRing, Legend } from '@/components/viz';

import type { CockpitProject } from './dashboard.hooks';
import { rankProjectHealth, type HealthTone } from './project-health';

const TONE_BADGE: Record<HealthTone, 'danger' | 'warning' | 'success' | 'muted'> = {
  bad: 'danger',
  warn: 'warning',
  good: 'success',
  idle: 'muted',
};

export const HEALTH_RING_COLORS = {
  billed: 'hsl(var(--info))',
  collected: 'hsl(var(--success))',
  paidOut: 'hsl(var(--primary))',
};

export function HealthLegend({ className }: { className?: string }) {
  return (
    <Legend
      className={className}
      items={[
        { color: HEALTH_RING_COLORS.billed, label: 'Billed' },
        { color: HEALTH_RING_COLORS.collected, label: 'Collected' },
        { color: HEALTH_RING_COLORS.paidOut, label: 'Paid out' },
      ]}
    />
  );
}

export function ProjectHealthWall({ projects, initial = 8 }: { projects: CockpitProject[]; initial?: number }) {
  const [showAll, setShowAll] = useState(false);
  const ranked = useMemo(() => rankProjectHealth(projects), [projects]);
  const shown = showAll ? ranked : ranked.slice(0, initial);

  return (
    <div className="space-y-4">
      <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((h) => {
          const p = h.project;
          return (
            <li key={p.projectId} className="min-w-0">
              <Link
                href={`/projects/${p.projectId}`}
                className={cn(
                  'group flex h-full items-center gap-3.5 rounded-2xl border border-border/80 bg-background/50 p-4 transition-all duration-200 hover:border-foreground/30 hover:bg-card hover:shadow-md hover:-translate-y-0.5',
                  h.tone === 'bad' && 'border-destructive/40 bg-destructive/[0.02]',
                )}
              >
                <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <HealthRing
                    size={68}
                    rings={[
                      { value: h.billed, color: HEALTH_RING_COLORS.billed, label: 'Billed' },
                      { value: h.collected, color: HEALTH_RING_COLORS.collected, label: 'Collected' },
                      { value: h.paidOut, color: HEALTH_RING_COLORS.paidOut, label: 'Paid out' },
                    ]}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: identityColor(p.projectId) }} />
                    <span className="truncate text-sm font-semibold tracking-tight text-foreground">{p.name}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {p.clientName ?? (p.clientId ? 'Deleted client' : 'Internal')}
                  </p>
                  <div className="my-1.5">
                    <Badge variant={TONE_BADGE[h.tone]}>{h.verdict}</Badge>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground/80">{h.detail}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {ranked.length > initial && (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show the riskiest only' : `Show all ${ranked.length} projects`}
          </Button>
        </div>
      )}
    </div>
  );
}
