// Layout for unauthenticated screens (login, forgot, reset, accept-invite):
// an editorial ink brand panel beside the auth form on wide screens, responsive on mobile.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

import { BrandLogo } from '@/components/layout/brand';

function OrbitTelemetry() {
  // Concentric activity rings echoing in-app project, cashflow, and team health.
  const rings = [
    { r: 108, pct: 0.82, color: 'hsl(var(--p1))', label: 'Projects', value: '82%', strokeWidth: 10 },
    { r: 86, pct: 0.94, color: 'hsl(var(--p2))', label: 'Cashflow', value: '94%', strokeWidth: 10 },
    { r: 64, pct: 0.76, color: 'hsl(var(--p3))', label: 'Team', value: '76%', strokeWidth: 10 },
  ];

  return (
    <div className="relative flex flex-col items-start gap-6">
      {/* Visual ring container with subtle ambient glow */}
      <div className="relative flex items-center justify-center">
        {/* Ambient radial blur behind rings */}
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <svg viewBox="0 0 260 260" className="h-56 w-56 sm:h-64 sm:w-64 relative drop-shadow-[0_0_24px_rgba(0,0,0,0.5)]" aria-hidden>
          <defs>
            <linearGradient id="orbit-grad-p1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--p1))" />
              <stop offset="100%" stopColor="hsl(var(--p1) / 0.8)" />
            </linearGradient>
            <linearGradient id="orbit-grad-p2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--p2))" />
              <stop offset="100%" stopColor="hsl(var(--p2) / 0.8)" />
            </linearGradient>
            <linearGradient id="orbit-grad-p3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--p3))" />
              <stop offset="100%" stopColor="hsl(var(--p3) / 0.8)" />
            </linearGradient>
          </defs>

          {rings.map((g, idx) => {
            const len = 2 * Math.PI * g.r;
            const gradId = `url(#orbit-grad-p${idx + 1})`;
            return (
              <g key={g.r}>
                {/* Background track */}
                <circle
                  cx="130"
                  cy="130"
                  r={g.r}
                  fill="none"
                  stroke="hsl(var(--rail-foreground) / 0.08)"
                  strokeWidth={g.strokeWidth}
                />
                {/* Active progress arc */}
                <circle
                  cx="130"
                  cy="130"
                  r={g.r}
                  fill="none"
                  stroke={gradId}
                  strokeWidth={g.strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${len * g.pct} ${len}`}
                  transform="rotate(-90 130 130)"
                />
              </g>
            );
          })}
        </svg>

        {/* Center badge inside rings */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="font-figures text-2xl font-bold tracking-tight text-white drop-shadow-sm">99.4%</span>
          <span className="text-[10px] uppercase font-mono tracking-wider text-rail-foreground/60 flex items-center gap-1.5 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Health Index
          </span>
        </div>
      </div>

      {/* Telemetry pill indicators aligned horizontally */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--p1))' }} />
          <span className="text-rail-foreground/70">Projects</span>
          <span className="font-figures font-semibold text-white">82%</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--p2))' }} />
          <span className="text-rail-foreground/70">Cashflow</span>
          <span className="font-figures font-semibold text-white">94%</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--p3))' }} />
          <span className="text-rail-foreground/70">Team</span>
          <span className="font-figures font-semibold text-white">76%</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.2fr_1fr] relative overflow-hidden">
      {/* Left editorial brand panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-rail p-10 lg:p-14 xl:p-16 text-rail-foreground lg:flex border-r border-border/30">
        {/* Ambient lighting & texture */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--rail-foreground)/0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />

        {/* Brand Header: perfectly left-aligned */}
        <div className="relative z-10 flex items-center gap-3">
          <BrandLogo tone="rail" className="h-6 w-auto" />
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] uppercase font-medium tracking-wider text-rail-foreground/60">
            Studio • v2.4
          </span>
        </div>

        {/* Center narrative & telemetry showcase */}
        <div className="relative z-10 my-auto space-y-9 py-10">
          <OrbitTelemetry />
          <div className="space-y-3.5 max-w-lg">
            <h1 className="font-display text-3xl xl:text-4xl font-bold leading-[1.14] tracking-tight text-white">
              Every project, every payment,{' '}
              <span className="text-brand">one calm place.</span>
            </h1>
            <p className="text-sm xl:text-base leading-relaxed text-rail-foreground/70">
              The unified agency operating system for modern creative and technology teams. Automated milestone billing, real-time margins, and zero-chaos execution.
            </p>
          </div>
        </div>

        {/* Bottom compliance & reassurance footer */}
        <div className="relative z-10 flex flex-col gap-3 pt-6 border-t border-white/[0.08] text-xs text-rail-foreground/50 xl:flex-row xl:items-center xl:justify-between">
          <p>ZOS — the Zlaark agency workspace</p>
          <div className="flex items-center gap-3 text-[11px] text-rail-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> SOC 2 Type II
            </span>
            <span>•</span>
            <span>256-bit TLS</span>
            <span>•</span>
            <span>99.99% SLA</span>
          </div>
        </div>
      </aside>

      {/* Right authentication panel */}
      <main className="relative flex min-h-screen flex-col items-center justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto bg-background">
        {/* Soft ambient glow centered behind auth form */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[480px] w-[480px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        {/* Mobile top bar */}
        <div className="relative z-10 mb-6 flex items-center gap-2.5 lg:hidden">
          <BrandLogo className="h-6" />
          <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 font-mono text-[10px] uppercase font-medium tracking-wider text-muted-foreground">
            ZOS
          </span>
        </div>
        <div className="hidden lg:block h-6" />

        {/* Centered Form Container */}
        <div className="relative z-10 w-full max-w-[420px] sm:max-w-[440px] my-auto">
          {children}
        </div>

        {/* Footer reassurance note */}
        <div className="relative z-10 mt-8 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-4">
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> Encrypted session
          </span>
          <span>•</span>
          <span>Privacy</span>
          <span>•</span>
          <span>Terms</span>
        </div>
      </main>
    </div>
  );
}
