// Owner command centre tiles: money flow (sankey), kept / margin, receivables aging, cash calendar.
// OWNER only — every figure comes from owner-only endpoints and renders through <Price> (or, inside
// SVG text and aria-labels, through formatCompact guarded by useCanSeePrices).
'use client';

import { CalendarRange, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { identityColor } from '@/lib/identity';

import { ViewToggle } from '@/components/data/view-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BigNumber,
  CalendarHeatmap,
  formatCompact,
  Legend,
  MoneyFlow,
  Price,
  SegmentBar,
  Sparkline,
  SpotIllustration,
  Tile,
  TrendDelta,
  useCanSeePrices,
  type FlowNode,
  type HeatDay,
} from '@/components/viz';

import type { AgingKey, CockpitAging, CockpitCashDay, CockpitFlow, OwnerCharts, OwnerCockpit } from './dashboard.hooks';

export const OUTFLOW_COLORS = {
  team: 'hsl(var(--primary))',
  freelancers: 'hsl(var(--info))',
  payroll: 'hsl(var(--warning))',
  expenses: 'hsl(var(--muted-foreground))',
  kept: 'hsl(var(--success))',
};

export const AGING_COLORS: Record<AgingKey, string> = {
  current: 'hsl(var(--success))',
  '1-30': 'hsl(var(--warning))',
  '31-60': 'hsl(var(--destructive) / 0.7)',
  '60plus': 'hsl(var(--destructive))',
};

const AGING_SHORT: Record<AgingKey, string> = {
  current: 'Not due',
  '1-30': '1–30 days',
  '31-60': '31–60',
  '60plus': '60+',
};

function inflowColor(key: string): string {
  if (key === 'other-income') return 'hsl(var(--info))';
  if (key === 'reserves') return 'hsl(var(--destructive))';
  if (key === 'other-clients' || key === 'unknown') return 'hsl(var(--muted-foreground))';
  return identityColor(key);
}

export function flowNodes(flow: CockpitFlow): { inflows: FlowNode[]; outflows: FlowNode[] } {
  const o = flow.outflows;
  return {
    inflows: flow.inflows.map((n) => ({ key: n.key, label: n.label, paise: n.paise, color: inflowColor(n.key) })),
    outflows: [
      { key: 'team', label: 'Team', paise: o.teamPaise, color: OUTFLOW_COLORS.team },
      { key: 'freelancers', label: 'Freelancers', paise: o.freelancerPaise, color: OUTFLOW_COLORS.freelancers },
      { key: 'payroll', label: 'Payroll', paise: o.payrollPaise, color: OUTFLOW_COLORS.payroll },
      { key: 'expenses', label: 'Expenses', paise: o.expensesPaise, color: OUTFLOW_COLORS.expenses },
      { key: 'kept', label: 'Kept', paise: Math.max(0, flow.keptPaise), color: OUTFLOW_COLORS.kept },
    ],
  };
}

type Period = 'month' | 'fy';

/** Sankey: clients in → agency → team / freelancers / payroll / expenses / kept, with a period toggle. */
export function MoneyFlowTile({
  cockpit,
  loading,
  expectedNextMonthPaise,
}: {
  cockpit?: OwnerCockpit;
  loading: boolean;
  expectedNextMonthPaise?: number;
}) {
  const [period, setPeriod] = useState<Period>('month');
  const canSee = useCanSeePrices();
  const flow = cockpit?.[period];
  const nodes = useMemo(() => (flow ? flowNodes(flow) : null), [flow]);
  const moved = !!flow && (flow.inPaise > 0 || flow.outPaise > 0);

  return (
    <Tile
      span={8}
      title={period === 'month' ? 'Where the money went this month' : `Where the money went in ${cockpit?.fy.label ?? 'this FY'}`}
      action={
        <ViewToggle
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'This month', icon: CalendarDays },
            { value: 'fy', label: 'This FY', icon: CalendarRange },
          ]}
        />
      }
    >
      {loading || !flow || !nodes ? (
        <Skeleton className="h-[260px] w-full" />
      ) : !moved ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <SpotIllustration kind="money" />
          <p className="text-sm text-muted-foreground">
            {period === 'month' ? 'No money has moved yet this month.' : 'No money has moved yet this financial year.'} Payments in and out will
            flow through here.
          </p>
        </div>
      ) : (
        <>
          {canSee && <MoneyFlow inflows={nodes.inflows} outflows={nodes.outflows} height={280} />}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              In <Price paise={flow.inPaise} compact className="font-semibold text-foreground" /> · out{' '}
              <Price paise={flow.outPaise} compact className="font-semibold text-foreground" />
              {flow.clientCount > 0 && ` · from ${flow.clientCount} client${flow.clientCount === 1 ? '' : 's'}`}
            </span>
            {period === 'month' && !!expectedNextMonthPaise && (
              <Link href="/expenses" className="hover:underline">
                Expected expenses next month <Price paise={expectedNextMonthPaise} compact />
              </Link>
            )}
          </div>
        </>
      )}
    </Tile>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortMonth = (m: string) => MONTHS[Number(m.split('-')[1]) - 1] ?? m;

/** The one ink tile: what the agency kept this month, margin and a 6-month trend. */
export function KeptTile({ flow, charts, loading }: { flow?: CockpitFlow; charts?: OwnerCharts; loading: boolean }) {
  const profit = (charts?.profitByMonth ?? []).slice(-6);
  const kept = flow?.keptPaise ?? 0;
  const margin = flow && flow.inPaise > 0 ? Math.round((kept / flow.inPaise) * 100) : null;
  const prev = profit.length >= 2 ? profit[profit.length - 2]!.profitPaise : 0;
  return (
    <Tile span={4} tone="ink" title={kept < 0 ? 'Spent more than came in' : 'Kept this month'}>
      {loading || !flow ? (
        <Skeleton className="h-36 w-full opacity-20" />
      ) : (
        <>
          <BigNumber
            caption={
              flow.inPaise === 0 && flow.outPaise === 0
                ? 'Nothing in or out yet this month'
                : margin !== null
                  ? `${margin}% margin on what came in`
                  : 'Nothing collected yet this month'
            }
          >
            <Price paise={kept} compact className={kept < 0 ? 'text-destructive' : 'text-brand'} />
          </BigNumber>
          <div className="mt-2 min-h-[1rem]">
            <TrendDelta current={kept} previous={prev} />
          </div>
          {profit.length >= 2 && (
            <div className="mt-3">
              <Sparkline values={profit.map((p) => p.profitPaise)} color="hsl(var(--primary))" height={64} />
              <div className="mt-1 flex justify-between text-xs opacity-70">
                <span>{shortMonth(profit[0]!.month)}</span>
                <span>{shortMonth(profit[profit.length - 1]!.month)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Tile>
  );
}

/** Receivables aging; each segment opens the invoices list filtered to that bucket. */
export function AgingTile({ aging, loading }: { aging?: CockpitAging; loading: boolean }) {
  const router = useRouter();
  const canSee = useCanSeePrices();
  return (
    <Tile
      span={5}
      title="Clients owe you"
      action={
        <Link href="/invoices?status=open" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Open invoices
        </Link>
      }
    >
      {loading || !aging ? (
        <Skeleton className="h-32 w-full" />
      ) : aging.outstandingPaise === 0 ? (
        <div className="flex items-center gap-3 py-3">
          <SpotIllustration kind="done" className="h-16 w-20" />
          <p className="text-sm text-muted-foreground">Nothing outstanding. Every invoice you've sent is paid.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <BigNumber
            caption={
              aging.overdueCount > 0
                ? `${aging.overdueCount} overdue invoice${aging.overdueCount === 1 ? '' : 's'} · ${aging.openCount} open in all`
                : `${aging.openCount} open invoice${aging.openCount === 1 ? '' : 's'}, none late`
            }
          >
            <Price paise={aging.outstandingPaise} compact />
          </BigNumber>
          <SegmentBar
            segments={aging.buckets.map((b) => ({
              value: b.paise,
              color: AGING_COLORS[b.key],
              label: `${b.label} (${b.count})`,
              display: canSee ? formatCompact(b.paise) : '',
              onClick: () => router.push(`/invoices?status=open&aging=${b.key}`),
            }))}
          />
          <Legend
            items={aging.buckets.map((b) => ({
              color: AGING_COLORS[b.key],
              label: (
                <Link href={`/invoices?status=open&aging=${b.key}`} className="hover:text-foreground hover:underline">
                  {AGING_SHORT[b.key]}
                  {b.count > 0 && <span className="font-figures"> · {b.count}</span>}
                </Link>
              ),
            }))}
          />
        </div>
      )}
    </Tile>
  );
}

/** 26 weeks of cash in vs out, one split cell per day. */
export function CashCalendarTile({ cash, loading }: { cash?: CockpitCashDay[]; loading: boolean }) {
  const canSee = useCanSeePrices();
  const days: HeatDay[] = useMemo(() => (cash ?? []).map((d) => ({ date: d.date, a: d.inPaise, b: d.outPaise })), [cash]);
  const totalIn = (cash ?? []).reduce((s, d) => s + d.inPaise, 0);
  const totalOut = (cash ?? []).reduce((s, d) => s + d.outPaise, 0);
  return (
    <Tile
      span={12}
      title="Cash calendar · last 26 weeks"
      action={
        <Legend
          items={[
            { color: 'hsl(var(--success))', label: 'Money in' },
            { color: 'hsl(var(--primary))', label: 'Money out' },
          ]}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <CalendarHeatmap
            days={days}
            weeks={26}
            labelA="In"
            labelB="Out"
            colorA="hsl(var(--success))"
            colorB="hsl(var(--primary))"
            format={(v) => (canSee ? formatCompact(v) : '')}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {totalIn === 0 && totalOut === 0 ? (
              'No payments in or out in the last six months yet. Each day fills in as money moves.'
            ) : (
              <>
                <Price paise={totalIn} compact className="font-semibold text-foreground" /> came in and{' '}
                <Price paise={totalOut} compact className="font-semibold text-foreground" /> went out over 26 weeks. Hover a day for its
                totals.
              </>
            )}
          </p>
        </>
      )}
    </Tile>
  );
}
