// Project health for the owner command centre — turns the cockpit's per-project money into three ring
// values (billed, collected, paid out) and a verdict, with a risk score to sort the riskiest first.
import type { CockpitProject } from './dashboard.hooks';

export type HealthTone = 'bad' | 'warn' | 'good' | 'idle';

export interface ProjectHealth {
  project: CockpitProject;
  /** Share of the client budget invoiced (0..1+). */
  billed: number;
  /** Share of the client budget collected (0..1+). */
  collected: number;
  /** Share of agreed team + freelancer fees already paid (0..1+). */
  paidOut: number;
  /** Share of the planned time elapsed (null without dates). */
  elapsed: number | null;
  tone: HealthTone;
  verdict: string;
  /** Plain detail line, no amounts. */
  detail: string;
  risk: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

function elapsedShare(start: string | null, end: string | null, now = Date.now()): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.max(0, Math.min(1, (now - s) / (e - s)));
}

export function projectHealth(p: CockpitProject, now = Date.now()): ProjectHealth {
  const base = p.budgetPaise > 0 ? p.budgetPaise : p.invoicedPaise;
  const billed = ratio(p.invoicedPaise, base);
  const collected = ratio(p.collectedPaise, base);
  const paidOut = ratio(p.paidOutPaise, p.agreedPaise);
  const elapsed = elapsedShare(p.startDate, p.endDate, now);
  const unpaidInvoices = p.invoicedPaise - p.collectedPaise;

  let tone: HealthTone = 'good';
  let verdict = 'On track';
  let detail = `Billed ${pct(billed)} · collected ${pct(collected)}`;
  let risk = 0;

  if (p.agreedPaise > 0 && p.paidOutPaise > p.agreedPaise) {
    tone = 'bad';
    verdict = 'Over agreed fees';
    detail = `Paid out ${pct(paidOut)} of agreed fees`;
    risk = 3 + (paidOut - 1);
  } else if (p.paidOutPaise > 0 && p.paidOutPaise > p.collectedPaise && paidOut - collected > 0.25) {
    tone = 'bad';
    verdict = 'Paying out ahead of collections';
    detail = `Paid out ${pct(paidOut)} · collected ${pct(collected)}`;
    risk = 2.5 + (paidOut - collected);
  } else if (elapsed !== null && p.budgetPaise > 0 && elapsed - billed > 0.2) {
    tone = 'warn';
    verdict = 'Behind on billing';
    detail = `Time ${pct(elapsed)} · billed ${pct(billed)}`;
    risk = 2 + (elapsed - billed);
  } else if (p.invoicedPaise > 0 && unpaidInvoices > 0 && ratio(p.collectedPaise, p.invoicedPaise) < 0.5) {
    tone = 'warn';
    verdict = 'Waiting on the client';
    detail = `Collected ${pct(ratio(p.collectedPaise, p.invoicedPaise))} of what's billed`;
    risk = 1.5 + (1 - ratio(p.collectedPaise, p.invoicedPaise));
  } else if (p.budgetPaise === 0 && p.invoicedPaise === 0 && p.agreedPaise === 0) {
    tone = 'idle';
    verdict = 'No money set up';
    detail = 'Add a budget or fees to track it';
    risk = 0.5;
  } else if (billed >= 1 && collected >= 1) {
    verdict = 'Fully collected';
    risk = 0;
  } else {
    risk = 1 - collected;
  }

  return { project: p, billed, collected, paidOut, elapsed, tone, verdict, detail, risk };
}

/** Riskiest first; ties broken by name so the wall doesn't shuffle between renders. */
export function rankProjectHealth(projects: CockpitProject[], now = Date.now()): ProjectHealth[] {
  return projects
    .map((p) => projectHealth(p, now))
    .sort((a, b) => b.risk - a.risk || a.project.name.localeCompare(b.project.name));
}
