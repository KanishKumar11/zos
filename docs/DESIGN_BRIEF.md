# Phase 6 design brief — "Studio" redesign, shared rules for every page task

You are redesigning one area of ZOS (Zlaark's agency management app) in the new **Studio** look.
Read `docs/PHASE5_BRIEF.md` first: its engineering rules (MoneyInput, no silent failures, useConfirm,
edge cases, local dates, query invalidation, no pnpm, no package installs, no git commits, typecheck
commands) all still apply. This brief adds the design and the price rule.

The approved visual reference is the static preview at
`C:\Users\kanis\AppData\Local\Temp\claude\k--zos\d9d8eb75-7acf-48c1-ae68-bd152221beee\scratchpad\zos-studio-preview.html`
— open it and match its spirit: the owner command centre, project page, team member home, client portal.

## 1. The price rule (non-negotiable, checked in review)
- **Only the OWNER, and a CLIENT for their own company (portal pages), ever see real amounts.**
- ADMIN, LEAD, MEMBER and INTERN see an amount **only when it is their own pay** (their fee on a
  project, payouts made to them, their own payslip). Never project budgets, invoice values, client
  balances, margins, other people's pay, freelancer deals, expenses or income.
- The API already enforces this (presenters strip fields). The web is defence in depth:
  **every amount on screen goes through `<Price paise currency own? compact? />`** from
  `@/components/viz` (it renders nothing for viewers who may not see it). Do not call `formatPaise` /
  `formatCompact` directly in JSX for display. Exceptions only where `<Price>` can't work: a chart axis or
  tooltip text, CSV export, an aria-label, or an input's value. In those places guard with
  `useCanSeePrices(own)` from `@/components/viz` and only build the string when it is true.
- Staff variants of shared pages must not even *imply* amounts: no "₹—", no empty money columns,
  no budget bars. Replace them with non-money signals (progress %, milestone state, dates, counts).
- Never add a money field to a non-owner API response. If you need new API data for a money view, the
  endpoint must be `@Roles(Role.OWNER)` (and `apps/api/src/common/guards/role-matrix.spec.ts` must still pass).

## 2. Studio design language
Tokens are in `apps/web/src/app/globals.css` + `tailwind.config.ts`. Use them; no literal colours.
- **Surfaces:** paper canvas (`bg-background`), white tiles (`bg-card` + `border`), the ink rail.
  One `tone="ink"` tile per page at most, for the figure that matters most.
- **Colour:** Zlaark orange is the *accent* (`text-brand`, `bg-brand`, `bg-brand-wash`, `text-brand-ink`).
  Primary buttons are ink (the default `Button`); use `variant="brand"` only for the one hero action
  on a page (e.g. "Log payment"). Status colours: `success`, `warning`, `destructive`, `info`.
- **Identity colours:** every project and person has one deterministic colour everywhere —
  `identityColor(id)` from `@/lib/identity`, `<ProjectChip>`, `<Avatar>`, `<AvatarStack>`.
  Use them for chart series, timeline nodes, board cards.
- **Type:** `font-display` (Bricolage Grotesque) for heroes, big numbers and page titles only.
  `font-figures` (Geist Mono, tabular) for every number column. Body is Geist. Sentence case.
- **Narrative hero:** list and home pages open with `<Hero pageTitle=… crumbs=…>` — one plain sentence
  written from live data, key figures wrapped in `<HeroFigure>` / `<HeroMark>`, plus a one-line `lede`.
  e.g. "You're owed **₹4.2L** — **₹1.1L** of it is overdue across 3 clients." Write the sentence for the
  viewer's role (staff sentences contain no amounts). Handle zero/empty data with a kind sentence
  ("Nothing is overdue. Nice."). Detail pages may keep `PageHeader` (now display-font) with `crumbs`.
- **Bento:** compose with `<Bento>` + `<Tile span={3|4|5|6|7|8|12} title action tone>`, mixed sizes,
  not rows of identical cards. `<BigNumber caption>` for headline figures.
- **Show data, don't list it.** Building blocks in `@/components/viz`:
  `MoneyFlow` (sankey; owner only), `CalendarHeatmap` (two series per day), `SegmentBar` (aging,
  paid/due/unbilled; clickable segments), `DivergingBars` (who owes whom), `HealthRing` (concentric
  progress), `BurnBar` + `burnVerdict` (spent vs time), `FillJar` (agreed vs paid), `MilestoneJourney`
  + `journeyFromMilestones`, `Sparkline`, `TrendDelta`, `WeekStrip`, `ActivityTimeline`, `CountUp`,
  `Legend`, `SpotIllustration` (empty states), `PrivacyChip` ("Only you see these figures").
  recharts 2.15 is installed (Treemap, RadialBar, Area etc.) for anything else.
  Tables are still available as a secondary view ("Table" toggle) — keep `DataTable`, filters,
  CSV export and remembered list state working; the visual view is the default.
- **Motion:** tiles already `animate-rise`; `CountUp` for hero numbers. Keep it subtle; respect
  reduced motion (CountUp and the CSS already do).
- **Empty states:** `SpotIllustration` + one sentence + the create action.
- **Responsive:** must work at 375px wide. Bento collapses to one column; wide SVGs scroll inside
  their own container; no horizontal page scroll.
- **Dark mode:** check both. Never use `text-white`/`bg-black` except on top of an identity colour.

## 3. File boundaries
Edit only the files your task lists. **Do not edit** `components/ui/*`, `components/data/*`,
`components/layout/*`, `components/viz/*`, `globals.css`, `tailwind.config.ts`, `lib/*` — the lead is
restyling those in parallel. If you need a new visual, put it in your own feature folder
(e.g. `features/invoices/invoice-lanes.tsx`). If a shared primitive has a bug, report it, don't fix it.

## 4. Finish with
A short report: pages redesigned, new components, API changes (with roles), how prices are guarded
on each page, edge cases handled, anything left undone, and the final web (and api, if touched)
typecheck result.
