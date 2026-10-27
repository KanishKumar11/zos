// Owner home — the command centre: what the agency is owed, where the money went, and which projects
// need attention. OWNER only (dashboard/page.tsx routes other roles elsewhere); every figure comes
// from owner-only endpoints and renders through <Price>.
'use client';

import { ArrowRight, Receipt, Send } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Bento, Hero, HeroFigure, HeroMark, Price, PrivacyChip, SpotIllustration, Tile } from '@/components/viz';
import { AgingTile, CashCalendarTile, KeptTile, MoneyFlowTile } from '@/features/dashboard/cockpit-tiles';
import { useOwnerCharts, useOwnerCockpit, useOwnerDashboard, type OwnerCockpit } from '@/features/dashboard/dashboard.hooks';
import { projectHealth } from '@/features/dashboard/project-health';
import { HealthLegend, ProjectHealthWall } from '@/features/dashboard/project-health-wall';
import { useImportStatus, useOwed } from '@/features/payouts/payouts.hooks';

import { BillingReminders } from './billing-reminders';
import { DashboardNotifications } from './dashboard-notifications';
import { greeting } from './greeting';
import { MoneyOverview } from './money-overview';

function OwnerQuickActions() {
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  return (
    <>
      <Button size="sm" variant="outline" asChild>
        <Link href="/invoices?new=1">
          <Receipt className="mr-1.5 h-3.5 w-3.5" /> New invoice
        </Link>
      </Button>
      <Button size="sm" variant="brand" onClick={() => openLogPayment()}>
        <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
      </Button>
    </>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The headline, written from live data. Kind sentences for a new agency and for zero balances. */
function HeroSentence({ c }: { c: OwnerCockpit }) {
  const { aging, month, fy, projects } = c;
  const brandNew = aging.outstandingPaise === 0 && fy.inPaise === 0 && fy.outPaise === 0 && projects.length === 0;
  if (brandNew) {
    return <>Welcome to your command centre. Send your first invoice and the money will start telling its story here.</>;
  }
  const owed =
    aging.outstandingPaise === 0 ? (
      <>Nobody owes you a thing.</>
    ) : aging.overduePaise > 0 ? (
      <>
        You&apos;re owed{' '}
        <HeroFigure>
          <Price paise={aging.outstandingPaise} compact className="font-display" />
        </HeroFigure>{' '}
        —{' '}
        <HeroMark>
          <Price paise={aging.overduePaise} compact className="font-display" />
        </HeroMark>{' '}
        of it is overdue across {plural(aging.overdueClients || 1, 'client')}.
      </>
    ) : (
      <>
        You&apos;re owed{' '}
        <HeroFigure>
          <Price paise={aging.outstandingPaise} compact className="font-display" />
        </HeroFigure>
        , and none of it is late.
      </>
    );
  const out =
    month.outPaise > 0 ? (
      <>
        {' '}
        This month you&apos;ve paid out <Price paise={month.outPaise} compact className="font-display" />.
      </>
    ) : (
      <> Nothing has gone out yet this month.</>
    );
  return (
    <>
      {owed}
      {out}
    </>
  );
}

function HeroLede({ c, waiting }: { c: OwnerCockpit; waiting: number }) {
  const m = c.month;
  const parts: ReactNode[] = [];
  if (m.revenuePaise > 0) {
    parts.push(
      <span key="in">
        Collected <Price paise={m.revenuePaise} compact /> from clients this month (excl. GST)
        {m.keptPaise >= 0 ? (
          <>
            {' '}
            and kept <Price paise={m.keptPaise} compact />.
          </>
        ) : (
          <>
            , but spent <Price paise={-m.keptPaise} compact /> more than came in.
          </>
        )}
      </span>,
    );
  } else if (m.outPaise > 0) {
    parts.push(<span key="in">No client payments have landed yet this month.</span>);
  }
  if (waiting > 0) {
    parts.push(
      <span key="wait">
        {' '}
        {waiting === 1 ? '1 person is' : `${waiting} people are`} waiting on payments you agreed.
      </span>,
    );
  }
  if (parts.length === 0) return <>Payments in and out, invoices and project health all show up here as they happen.</>;
  return <>{parts}</>;
}

export function OwnerHome() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];
  const cockpit = useOwnerCockpit(true);
  const owner = useOwnerDashboard(true);
  const charts = useOwnerCharts(true);
  const owed = useOwed();
  const imports = useImportStatus();
  const c = cockpit.data;
  const loading = cockpit.isLoading;
  const waiting = (owed.data?.team.length ?? 0) + (owed.data?.freelancers.length ?? 0);
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());

  const riskyProjectsCount = (c?.projects ?? []).map((p) => projectHealth(p)).filter((h) => h.tone === 'bad').length;

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Command centre"
        eyebrow={
          <>
            {greeting()}
            {firstName ? `, ${firstName}` : ''} · Command centre · {monthLabel}
          </>
        }
        aside={
          <>
            <PrivacyChip>Only you see these figures</PrivacyChip>
            <OwnerQuickActions />
          </>
        }
        loading={loading}
        lede={c ? <HeroLede c={c} waiting={waiting} /> : undefined}
      >
        {c ? <HeroSentence c={c} /> : 'Your agency at a glance.'}
      </Hero>

      {/* Real-time Agency Pulse Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {/* Metric 1: Live Projects */}
        <Link
          href="/projects"
          className="group rounded-2xl border border-border/80 bg-card/85 p-4 backdrop-blur-sm transition-all duration-200 hover:border-foreground/30 hover:bg-card hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Projects</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </div>
          <div className="mt-2 text-2xl font-bold font-figures tracking-tight">
            {c ? c.projects.length : <Skeleton className="h-7 w-12" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {c ? (riskyProjectsCount > 0 ? `${riskyProjectsCount} need attention` : 'All on track') : '…'}
          </p>
        </Link>

        {/* Metric 2: Collected Month */}
        <Link
          href="/invoices?status=PAID"
          className="group rounded-2xl border border-border/80 bg-card/85 p-4 backdrop-blur-sm transition-all duration-200 hover:border-foreground/30 hover:bg-card hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collected</span>
            <span className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
          </div>
          <div className="mt-2 text-2xl font-bold font-figures tracking-tight">
            {c ? <Price paise={c.month.revenuePaise} compact /> : <Skeleton className="h-7 w-20" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {c ? (c.month.inPaise > 0 ? `${Math.round((c.month.keptPaise / c.month.inPaise) * 100)}% kept margin` : 'This month') : '…'}
          </p>
        </Link>

        {/* Metric 3: Outstanding Receivables */}
        <Link
          href="/invoices?status=open"
          className="group rounded-2xl border border-border/80 bg-card/85 p-4 backdrop-blur-sm transition-all duration-200 hover:border-foreground/30 hover:bg-card hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receivables</span>
            <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
          </div>
          <div className="mt-2 text-2xl font-bold font-figures tracking-tight">
            {c ? <Price paise={c.aging.outstandingPaise} compact /> : <Skeleton className="h-7 w-20" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {c ? (c.aging.overdueCount > 0 ? `${c.aging.overdueCount} overdue` : 'Zero overdue') : '…'}
          </p>
        </Link>

        {/* Metric 4: Payouts Due */}
        <Link
          href="/payments"
          className="group rounded-2xl border border-border/80 bg-card/85 p-4 backdrop-blur-sm transition-all duration-200 hover:border-foreground/30 hover:bg-card hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid Out</span>
            <span className="h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20" />
          </div>
          <div className="mt-2 text-2xl font-bold font-figures tracking-tight">
            {c ? <Price paise={c.month.outPaise} compact /> : <Skeleton className="h-7 w-20" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {waiting > 0 ? `${waiting} awaiting pay` : 'All settled'}
          </p>
        </Link>
      </div>

      {imports.data?.pending && (
        <Link
          href="/payments"
          className="flex items-center gap-3 rounded-2xl border border-info/30 bg-info/5 px-4 py-3 text-sm transition-colors hover:bg-info/10"
        >
          <span className="flex-1">
            <span className="font-medium">Older payments need importing.</span> Bring them into Payments out so balances and profit are
            complete.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="space-y-2 empty:hidden">
        <DashboardNotifications />
        <BillingReminders />
      </div>

      {cockpit.isError ? (
        <div className="rounded-2xl border bg-card">
          <ErrorState error={cockpit.error} onRetry={() => void cockpit.refetch()} title="Couldn't load your figures" />
        </div>
      ) : (
        <Bento>
          <MoneyFlowTile cockpit={c} loading={loading} expectedNextMonthPaise={owner.data?.expensesNextMonth} />
          <KeptTile flow={c?.month} charts={charts.data} loading={loading} />
          <AgingTile aging={c?.aging} loading={loading} />
          <MoneyOverview span={7} />
          <CashCalendarTile cash={c?.cash} loading={loading} />
          <Tile
            span={12}
            title={c && c.projects.length > 0 ? `Project health · ${c.projects.length} live, riskiest first` : 'Project health'}
            action={<HealthLegend />}
          >
            {loading || !c ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : c.projects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <SpotIllustration kind="projects" />
                <p className="text-sm text-muted-foreground">No live projects yet. Start one and its health shows up here.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/projects?new=1">New project</Link>
                </Button>
              </div>
            ) : (
              <ProjectHealthWall projects={c.projects} />
            )}
          </Tile>
        </Bento>
      )}
    </div>
  );
}
