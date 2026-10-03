// Layout for unauthenticated screens (login, forgot, reset, accept-invite): an ink brand panel
// beside the form on wide screens, the form alone on phones.
// force-dynamic prevents Next.js from statically pre-rendering auth pages at build time.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';

import { BrandLogo, BrandMark } from '@/components/layout/brand';

function Orbit() {
  // Decorative concentric rings echoing the in-app health rings.
  const rings = [
    { r: 120, pct: 0.78, color: 'hsl(var(--p1))' },
    { r: 96, pct: 0.56, color: 'hsl(var(--p2))' },
    { r: 72, pct: 0.9, color: 'hsl(var(--p3))' },
  ];
  return (
    <svg viewBox="0 0 280 280" className="h-64 w-64 opacity-90" aria-hidden>
      {rings.map((g) => {
        const len = 2 * Math.PI * g.r;
        return (
          <g key={g.r}>
            <circle cx="140" cy="140" r={g.r} fill="none" stroke="hsl(var(--rail-foreground) / 0.08)" strokeWidth="14" />
            <circle
              cx="140"
              cy="140"
              r={g.r}
              fill="none"
              stroke={g.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${len * g.pct} ${len}`}
              transform="rotate(-90 140 140)"
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 text-rail-foreground lg:flex">
        <BrandLogo tone="rail" className="h-8" />
        <div className="space-y-8">
          <Orbit />
          <p className="font-display max-w-[16ch] text-[2.75rem] font-bold leading-[1.02]">
            Every project, every payment, <span className="text-brand">one calm place.</span>
          </p>
        </div>
        <p className="text-xs text-rail-foreground/50">ZOS — the Zlaark agency workspace</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <BrandMark className="h-9 w-9" />
          <BrandLogo className="h-6" />
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
