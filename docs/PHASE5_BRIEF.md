# Phase 5 brief — shared rules for every page polish task

You are improving one area of ZOS (agency management app). Monorepo at `K:\zos\agency-panel`:
- `apps/web` — Next.js 16 App Router + React Query + Tailwind. Path alias `@/` → `apps/web/src`.
- `apps/api` — NestJS + Mongoose. Path alias `@/` → `apps/api/src`.
- `packages/shared` — zod schemas + enums used by both. After editing it, rebuild: `cd packages/shared && ../../node_modules/.bin/tsc -p tsconfig.json`.

**Do not install packages** (pnpm is blocked on this machine). **Do not run pnpm.** **Do not git commit.**
Typecheck with: `cd apps/web && ./node_modules/.bin/tsc --noEmit -p .` and `cd apps/api && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` (slow — run once at the end, then fix). API unit tests: `cd apps/api && ./node_modules/.bin/jest`.
Shell tip: very long heredocs sometimes break in the Bash tool — prefer the Write/Edit tools for file content.

## Product rules (non-negotiable)
- Owner sees all money. Team members never see project money except their own pay. Client portal users only see their own company's projects/invoices. Server enforces this; never rely on hiding UI.
- UI language: sentence case, plain words, no SHOUTING uppercase or `font-mono` labels (mono only for codes/numbers like invoice numbers). Use the refined warm look already in place.
- **All money inputs use `MoneyInput`** (type ₹, store paise). Never ask users to type paise. Never `valueAsNumber` on optional fields.
- **Nothing fails silently.** Every form shows field errors (`FormField error=`), server errors are shown (`getErrorMessage(err)` from `@/lib/api-client`; `ApiRequestError.fieldErrors` maps server field errors). Optional inputs: use `emptyToUndefined` / `emptyToUndefinedNumber` from `@/lib/form`.
- Destructive or irreversible actions use `useConfirm()` (from `@/components/ui/confirm-dialog`) with a clear consequence sentence. Never `window.confirm`.
- Handle edge cases deliberately: empty lists (EmptyState with a create action), loading (skeletons), API errors (ErrorState with retry), deleted/missing linked records (show "Deleted client" etc., never raw ids / `id.slice(-6)`), duplicates, over-payments, dates in local time (`todayLocal()`, `toLocalDateInput()` from `@/lib/form` — never `toISOString().slice(0,10)` for "today").
- Mutations: invalidate every query whose numbers change (lists, details, `['dashboard']`, and money views via `invalidateMoney(qc)` from `@/features/projects/projects.hooks` when payouts/projects/invoices change totals).

## Building blocks (already exist — reuse, don't reinvent)
- Layout: `PageHeader` (`@/components/layout/page-header`: `title`, `description`, `action`, `crumbs=[{label,href}]`, `meta` for badges) — it also sets breadcrumbs + browser tab title. Detail pages must pass `crumbs`.
- `useListState(pageKey, defaults)` from `@/lib/list-state`: keeps search/filters/sort/page in the URL and remembers them per page. Returns `{ params, page, sort, set, reset, setPage, setSort, activeFilterCount }`.
- `DataTable`, `sortRows`, `exportColumnsCsv`, `Column<T>` from `@/components/data/data-table` (sortable headers, skeleton, error, empty, footer totals via `column.footer` + `showFooter`, `rowHref`, `onRowClick`, CSV via `column.csv`).
- `FilterBar`, `SearchFilter`, `SelectFilter`, `DateRangeFilter` (stores `range`,`from`,`to`), `ResetFilters`, `ExportButton` from `@/components/data/filter-bar`.
- `downloadCsv`, `csvMoney` from `@/lib/csv`. `presetRange`, `describeRange`, `inRange` from `@/lib/date-range`.
- UI: `MoneyInput`, `FormField`, `Combobox` (searchable picker), `Sheet*` (side drawer), `Tabs*`, `StatCard` (pass `href` to make it click through), `StatusBadge`/`statusLabel`, `ProgressBar`, `EmptyState`/`ErrorState`/`TableSkeleton`/`PageSkeleton` (`@/components/ui/states`), `Badge` (variants: default, secondary, outline, success, warning, info, danger, muted), `Pagination` (`pageSize` prop shows "Showing 21–40 of 134").
- `useNewParam(() => setCreateOpen(true))` from `@/components/layout/quick-actions` — list pages must open their create dialog when the URL has `?new=1` (the global "+ New" menu links to e.g. `/invoices?new=1`, `/expenses?new=1`, `/projects?new=1`, `/team?new=1`).
- Audit trail: in API services use `emitAudit(this.events, { actorId, action: AuditAction.X, entity, entityId, summary, before, after })` from `@/common/utils/audit.util` (inject `EventEmitter2` from `@nestjs/event-emitter`). Actions live in `packages/shared/src/enums/audit-action.enum.ts` (add new ones there if needed, plus a label in `AUDIT_ACTION_LABEL`).
- Good reference implementations to copy patterns from: `apps/web/src/app/(app)/payments/page.tsx` (list page), `apps/web/src/app/(app)/clients/page.tsx`, `apps/web/src/app/(app)/clients/[id]/page.tsx` (detail with tabs), `apps/web/src/features/payouts/log-payment-sheet.tsx` (smart form), `apps/web/src/features/clients/client-form-dialog.tsx` (dialog form).

## Finish with
A short report: files changed, behaviours fixed, any edge cases you chose not to handle and why, and the final typecheck result (paste errors if any remain).
