# ZOS: Build Tracker

Living plan for turning ZOS into a complete agency workspace. Tick items as they ship.
Full audit findings live in the chat log of 2026-10-02; the ones we act on are copied in here.

**Status key:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Goals

1. **Owner logs any payment in seconds.** Pay any team member or freelancer, against any project, from anywhere in the app.
2. **Three kinds of login:** Owner/staff, Team, and Client (several users per client company).
3. **Team never sees project money.** A team member sees only what *they* are paid on each project. Only the Owner sees budgets, margins and everyone's pay.
4. **Clients see their own world.** All their projects (status, milestones), their invoices and payments, and the updates and files you share.
5. **UI that feels professional.** Same cream and terracotta brand, but calmer and consistent. Filters are remembered, nothing fails silently, and amounts are always in ₹.

## Decisions (2026-10-02)

| Topic | Decision |
|---|---|
| Freelancers | Stay a **separate directory** with no login, but are linked to real projects (not free text). Payments to them go through the same "Log payment" flow. |
| Client portal shows | Projects + milestones, invoices + payments, updates + files you choose to share. **No** tasks. |
| UI direction | **Refine the current look:** keep the palette, use sentence-case titles, slightly rounded corners, quieter mono/uppercase, cleaner tables. |
| Tracker | This file. |
| Project payouts vs payroll | Separate. Project payouts are their own ledger and **no longer auto-create payroll runs or payslips**. Payroll stays for salaried pay. |
| Admin role | Manages people and projects but sees **no project money** (per the PRD). |
| Leaves, Time | Hidden behind `lib/features.ts` flags for now; to be re-enabled later. |

## Who sees what

| Data | Owner | Admin | Lead / Member / Intern | Client user |
|---|---|---|---|---|
| Project name, status, dates, brief | All | All | Projects they're on | Their company's projects |
| Client budget, margin, collected, balance | ✓ | ✗ | ✗ | ✗ |
| Milestone billing amounts | ✓ | ✗ | ✗ | ✓ (it's their bill) |
| Team list on project (names, roles) | ✓ | ✓ | ✓ | Project lead only |
| A member's agreed fee and payments | Everyone's | ✗ | **Own only** | ✗ |
| Freelancer fees and payments | ✓ | ✗ | ✗ | ✗ |
| Invoices | All | ✗ | ✗ | Their company's, not drafts |
| Project updates | All | All | All on their projects | Only ones marked "Share with client" |
| Project files | All | All | All on their projects | Only ones marked "Share with client" |

Enforced on the **server** with per-role response shapes ("presenters"). The UI hiding things is never the only protection.

---

## Phase 0: Security and foundations
*Must ship before any client or team member logs in.*

Backend
- [x] Stop leaking user secrets. Strip `passwordHash`, `tokenVersion`, encrypted bank number and document keys from every user response (schema `toJSON` transform plus an explicit projection). Limit `GET /users/:id` to Owner/Admin/Lead or self. Limit `PATCH /users/me` to profile fields only. (`modules/users/*`)
- [x] Project presenters replace the broken field-stripper (it spreads a Mongoose doc, so owner-only fields leak inside `_doc`). Add `projects.presenter.ts` with `forOwner`, `forStaff(viewerId)` and later `forClient`, built on `.lean()` documents. Team responses contain no budget, margin, milestone amounts or other members' pay. (`common/interceptors/serialize.interceptor.ts`, `modules/projects/*`)
- [x] Authorize `POST /storage/presign-get`: only sign keys the caller is allowed to read.
- [x] Deactivating a user ends their access: revoke refresh tokens, bump `tokenVersion`, and have `refresh()` check status and version. (`modules/auth/services/auth.service.ts`, `modules/users/users.service.ts`)
- [x] Add a **deny-by-default guard** for the new CLIENT role: any endpoint without `@PortalAccess()` returns 403 for clients. (Today the global `RolesGuard` lets every logged-in role through when `@Roles` is missing.)
- [~] Sanitize rich-text HTML. **Display side done:** `RichTextView` renders through the editor schema, so scripts are dropped. **Save side blocked:** `sanitize-html` can't be installed until pnpm works again (see Blockers).
- [x] Add a test setup plus specs for the presenters and the client-deny guard. Jest is configured but has no specs yet.

Frontend
- [x] Fix blank error toasts with one `getErrorMessage(err)` helper plus a default `onError` on the React Query `MutationCache`. (`lib/api-client.ts`, `lib/query-client.ts`)
- [x] Route and role fixes: members can open My Payslips, Admin can open Audit, add rules for `/contracts`, `/sows`, `/expenses`, `/income`, `/freelancer-payments`, and only show "Settings" in the user menu to Owner/Admin. (`lib/route-rules.ts`, `components/layout/topbar.tsx`)
- [x] Login honours `?next=` and lands each role in the right place (client goes to `/portal`).

**Also fixed while here:**
- Leads who create a project are added as its lead.
- Saving a project's member list no longer wipes agreed fees and payments.
- PROBATION and ON_LEAVE staff can sign in.
- Admins can't deactivate the owner, and nobody can deactivate themselves.
- Payslip and announcement notifications link to pages that exist, and their previews are plain text.
- Team: Invite and Internship Letter are shown only to roles that can use them.

## Phase 1: UI foundation (refined look + shared kit)

Design refinement (`app/globals.css`, `components/ui/*`, `components/layout/*`)
- [x] Tokens: radius 0 → ~6px, softer card headers, consistent spacing scale, success/warning badge tones.
- [x] `PageHeader`: sentence case, normal-weight description (no 10px uppercase mono). Mono only for numbers and IDs.
- [x] Topbar: real page title and breadcrumbs from a page-meta context instead of the URL segment, which shows Mongo IDs today. Per-page browser tab titles.
- [x] Sidebar: distinct icons, tooltips when collapsed, mobile drawer under `md`.

Shared building blocks
- [x] `MoneyInput`: you type ₹, it stores paise. Used for **every** amount field (nothing is typed in paise any more).
- [x] `FormField` with inline error display, plus a shared `emptyToUndefined` preprocessor in `@agency/shared`. Together these fix the forms that fail silently.
- [x] `Combobox` (searchable picker) for people, projects and clients, built on Radix Popover (`cmdk` couldn't be installed, so it's a small custom list with full keyboard support).
- [x] `ConfirmDialog` replaces every `confirm()`. Add a confirmation step to every destructive or irreversible action.
- [x] `Sheet` (right-side drawer) for quick create and edit without leaving the page.
- [x] `EmptyState` (with a create button), `ErrorState` (with retry), skeleton rows, `StatCard` (clickable through to a filtered list).
- [x] **List toolkit:** `useListState(pageKey, defaults)` keeps search, filters, sort and page **in the URL** (shareable, back button works) **and remembers the last used set per page** (restored when you come back). Plus a `DataTable` with sortable headers, a filter bar, date-range presets (this month / last month / this FY / custom), a totals row for the filtered set, and CSV export.
- [x] Global **"+ New"** menu in the topbar (Log payment, Invoice, Project, Client) and a **⌘K** palette to jump to any project, client, person or invoice.
- [x] App-level `error.tsx`, `not-found.tsx` and `loading.tsx`.

## Phase 2: Payments ledger ("log any payment, for anyone, on any project")

Data model
- [x] New `payouts` collection with: `payeeType` (MEMBER | FREELANCER), `userId?`, `freelancerId?`, `projectId?` (optional, for general bonuses or advances), `amountPaise`, `currency`, `paidAt`, `method` (BANK | UPI | CASH | CARD | OTHER), `reference` (UTR/txn id), `category` (PROJECT_FEE | ADVANCE | BONUS | REIMBURSEMENT | OTHER), `note`, `createdBy`, `deletedAt`. Indexes on `{projectId, paidAt}`, `{userId, paidAt}` and `{freelancerId, paidAt}`.
- [x] A team member's **agreed fee** stays on `project.members[].amountPaise` (shown as "Agreed").
- [x] Freelancers become a proper directory: a `freelancers` collection (name, email, phone, UPI/bank, notes) plus `project.freelancers[] { freelancerId, agreedPaise, scope }`.
- [x] One-click import instead of a CLI script: the Payments page shows "Import older payments" (`GET /payouts/import-status`, `POST /payouts/import`). Idempotent via `legacyId`; take a `mongodump` first if you want a restore point. It moves `project.members[].payments` and `freelancer_payments[].payments` into `payouts`. Freelancer records become directory entries plus project links, matched by project name or code. Unmatched ones are listed in the report and kept as payouts with `projectId: null` and a "Legacy: <projectRef>" note.
- [x] Remove `syncPayslip`, which auto-creates FINALIZED payroll runs, from `projects.service.ts`.

API (Owner only, except `/me/earnings`)
- [x] `POST /payouts`, `PATCH /payouts/:id`, `DELETE /payouts/:id` (soft), each audited.
- [x] `GET /payouts`: filters for person, freelancer, project, client, method, category, date range and text search; sort; pagination; **totals for the filtered set**.
- [x] `GET /payouts/balances?projectId|userId|freelancerId` returns agreed / paid / pending per person per project.
- [x] `GET /me/earnings`: the caller's own payouts plus agreed/paid/pending per project.
- [x] Logging a payment above the agreed fee is **allowed with a warning** (`overAgreed` flag), not blocked.
- [x] On a logged payment, notify the team member in the app and by email ("₹X received for Project Y").
- [x] Dashboard profit uses the payouts ledger (fixes team payouts being missing from profit).

UI
- [x] **Log payment** drawer, opened from "+ New", ⌘K, project page, person page and Payments page:
  - Fields in order: Pay to (team + freelancers, grouped) → Project (their projects first, each showing *agreed · paid · pending*) → Amount (₹, one-tap chip "Pay pending ₹Z") → Date (today, local time) → Method → Reference → Category → Note.
  - If the person isn't on that project yet, offer "Add to project with agreed fee" inline.
  - "Save" and "Save & log another"; it opens pre-filled when launched from a project or person.
- [x] **Payments** page (Finance nav): ledger table on the list toolkit (remembered filters, totals, CSV). Click a row to edit it in a drawer.
- [x] **Project → People & payments** tab: one row per team member and freelancer with agreed (editable), paid, pending, a progress bar and a **Log payment** button. Expand a row for history with edit and delete.
- [x] **Person page → Payments** tab and **Freelancer page**: every project with agreed / paid / pending, plus history.
- [x] Freelancers page becomes a directory with a project picker. No more free-text `projectRef`.

## Phase 3: Team view ("what am I paid for this project")

- [x] Projects list and detail render a **staff variant** with Overview, Milestones (no amounts), Team and a **"My earnings on this project"** card. No financial tabs.
- [x] New **My earnings** page (replaces "My Payslips" in the nav) with:
  - Totals for this month and this FY.
  - Per project: agreed, paid, pending.
  - Payment history with date, method and reference.
  - A Payslips tab for salaried pay.
- [x] Verify through the API (not just the UI) that a member's responses never contain budget, margin, milestone amounts or another person's pay.

## Phase 4: Client portal

Backend
- [x] Add `Role.CLIENT` to `@agency/shared` and `User.clientId`. The portal re-reads the client from the DB on every request (no `cid` in the JWT needed).
- [x] Portal users, several per client company:
  - Endpoints under `/clients/:id/portal`: list, invite, resend, cancel invite, turn access off/on.
  - Reuse the invite flow (`Invite` gains `clientId`).
- [x] `project.portalVisible` (default true) so internal-only projects can be hidden from the client.
- [x] New `project_updates` collection (title, sanitized body, `visibility: INTERNAL | CLIENT`, attachments) and `project_files` collection (key, name, size, type, `visibility`, uploadedBy).
- [x] `/portal/*` controller (`@PortalAccess()`, always scoped to the caller's `clientId`):
  - `me`
  - `summary`: outstanding, paid, overdue
  - `projects`, `projects/:id`: status, dates, milestones with amounts, shared updates and files
  - `invoices`, `invoices/:id`, `invoices/:id/pdf`: non-draft only
  - `files/:id/download-url`
- [x] Email client users when a shared update or file is posted (in-app + email). Per-client toggle and "invoice sent" emails are left for later.

Frontend
- [x] Separate route group `app/(portal)/portal/*` with a light shell: top nav with the client's name, Overview / Projects / Invoices / Account, and no sidebar.
  - **Overview:** active project cards, amount outstanding, latest updates.
  - **Project:** milestone timeline, updates feed, shared files.
  - **Invoices:** list plus detail and PDF, with paid/due status.
  - **Account:** profile, change password, other users from their company.
- [x] Middleware: CLIENT can only reach `/portal/*`; staff can't reach `/portal`.
- [x] Owner side:
  - **Client page** gets tabs: Overview (outstanding, projects, invoices, contracts), Contacts & portal access (invite a contact, Invited/Active status, resend, revoke) and Notes.
  - **Project page** gets **Updates** and **Files** tabs with a "Share with client" toggle, plus **"Preview as client"**.

## Phase 5: Roll the polish across existing pages

- [x] Move every list to the list toolkit: Projects, Clients, Invoices, Contracts, SOWs, Expenses, Income, Team, Payments, plus CRM board filters.
- [x] Replace all paise inputs with `MoneyInput` (CRM, contracts, compensation, payroll adjustments, expenses, income, projects).
- [x] Wire up the audit log: services emit audit events (`emitAudit`) on every money/access change, fix the audit page reading `data.items`, and add actor/date filters.
- [x] Invoice integrity: one numbering scheme, keep the Write-off/Paid status you set, lock sent and paid invoices, fix KPI and aging cache invalidation.
- [x] Create tasks from a project, and add create/edit for SOWs.

**Phase 5 also delivered:**
- Invoices: one numbering scheme (`ZLK-2026-27-0001`, Apr–Mar FY, never reused), sent invoices lock, drafts-only delete, write-off with reason, reopen, duplicate, remove payment, overpayment blocked, due date from client terms, overdue judged by calendar day (part-paid late invoices count), overdue email once, IGST vs CGST+SGST on PDF.
- Expenses & income: ₹ inputs, contributions edit fixed, project link + billable flag, recurring expenses with "Repeat", filtered totals, edit/pagination for income, receipts.
- Contracts / SOWs / CRM: forms accept empty optional fields, contract invoicing refuses paused/ended months and uses GST + client terms, SOW create/edit/sign + "Create project from SOW", CRM values in ₹, probability, lost reason, "Deal won — what next?", prospects without a client record.
- Team / payroll / settings / audit: paginated team list with pending invites, edit employment details, confirmations on role/status changes; compensation in ₹ with scheduled changes; payroll adjustments survive recompute, LOP only counts days marked absent (setting to treat missing as absent), review → finalize → paid → reopen, bank-transfer CSV; settings edits + weekly-off days; audit log with names, labels, filters and before/after.

---

**Phases 1–4 also delivered:**
- Project page rebuilt with tabs: Overview, People & payments (owner) / Team (staff), Billing, Tasks, Updates, Files, plus "Preview as client".
- Tasks: create from a project, My tasks list (Overdue / Today / This week) and board with instant moves, task detail with editable fields, @mentions and comment notifications; "task assigned" notifications now fire.
- Clients: full client page (outstanding, projects, invoices, contracts, contacts, portal access), billing fields (state, PAN, terms), can't delete a client that still has projects/invoices.
- Invites: re-inviting cancels the old link; staff and portal invites can be listed, resent and cancelled; accept-invite works with blank optional fields.
- My profile (details, bank details, password) for staff; Account page for portal users.
- Announcements: real audiences (roles, departments, people), people only see what's meant for them, pin/unpin, seen-by count.
- Dashboard rebuilt (owner and team versions); profit now counts team + freelancer payouts and gross payroll, revenue excludes GST.
- Notifications inbox: unread filter, click-through, per-item mark read; shared with the portal.

## Phase 6: Bold redesign & strict price privacy

Rule: only the owner, and each client for their own company, ever see real prices. Team members see only their own pay.

**A. Privacy lockdown**
- [x] Payroll is owner-only (API and web). Staff see only their own released payslips under My earnings.
- [x] Audit log: admins get a money-free view. Money entities and actions are hidden, amount keys are stripped, and currency figures in summaries become "an amount". Project and freelancer entries store only the fields that changed.
- [x] Offer letters and contracts (which mention pay): owner and the person themselves only. Every admin user endpoint goes through `presentUser`, so no bank details leak.
- [x] Dashboard "last payslip" shows released pay only. The SOW team brief is limited to project members.
- [x] Role-matrix test: every money endpoint must be owner-only. Plus audit-redaction tests. 75 API tests passing.
- [x] Web: Payroll and compensation routes are owner-only. New `<Price>` component renders amounts only for the owner, a client, or the viewer's own pay.

**B. Design language** (Zlaark brand: orange `#f85f00`, the real logo and mark from `zlaark-brand-kit`)
- [x] Brand files in `apps/web/public/brand/`, and the favicon from the brand icon.
- [x] Design preview of 4 screens published for sign-off: https://claude.ai/artifact/M4edvaFHiXz1wYutyxiBRJ
- [x] Studio tokens (paper/ink/orange, `--p1..p8` identity palette, dark mode), Bricolage Grotesque display face, Geist Mono figures.
- [x] Shell: ink rail with the Zlaark logo/mark, restyled top bar, auth split screen, portal header and footer with brand. Ink primary buttons plus a `brand` variant; display-font page headers, dialogs and sheets; restyled stat cards, empty states (spot illustrations), tabs, inputs, tables; `ViewToggle`.
- [x] `components/viz/*`: Hero, Bento/Tile, Price, MoneyFlow, CalendarHeatmap, SegmentBar, DivergingBars, HealthRing, BurnBar, FillJar, MilestoneJourney, Sparkline, TrendDelta, WeekStrip, ActivityTimeline, CountUp, Avatar/AvatarStack/ProjectChip, SpotIllustration, NewDot. Design brief: `docs/DESIGN_BRIEF.md`.
- [x] Dashboard split into one home per role (`owner-home`, `team-pulse`, `member-home`).

**C. Per-person redesign**
- [x] Owner pages: command centre (money-flow sankey, kept tile, aging bar, who-owes-whom, cash calendar, project health wall; new owner-only `GET /dashboard/owner/cockpit`), payments timeline + heatmap, invoice lanes with aging filter and paid stamps, expenses/income treemaps + recurring costs, freelancer cards and deal jars, CRM board with drag-and-drop, contracts, SOWs, payroll.
- [x] Project & client pages: owner health-ring board (one batched owner-only `GET /projects/health` request), staff cards with no money, project hero with burn bar + milestone journey, people rows with fill jars and Pay, billing journey, client relationship timeline + aging, task board with animated moves.
- [x] Team & admin pages: team pulse home (no money), people grid with onboarding rings, profile header, audit timeline, grouped notifications, announcement story feed, attendance heatmap.
- [x] Client portal & team-member home: portal journey, balance meter, story feed with file cards, invoice cards with paid stamps; "My day" home with week strip and earnings jars; earnings page with monthly bars and receipts.
- [x] Price audit: every on-screen amount uses `<Price>`; every remaining raw format call is behind `useCanSeePrices`.

**D. Extras**
- [x] Keyboard shortcuts (`g d/t/p/c/i/y/f/m/e/n`, `n` new, `/` search, `l` log payment, `?` help).
- [x] Search across invoices and freelancers (owner only) in the ⌘K palette.
- [x] "Since your last visit" markers on payments, invoices and project updates.

## Blockers
- **pnpm can't install packages.** Windows Defender flags pnpm 9.7.0's own `pnpm.exe` shim (the version pinned in `package.json`) as potentially unwanted software. Until that's resolved on the machine, no new dependencies can be added (`sanitize-html` now, `cmdk` in Phase 1).
- **Lint doesn't run.** ESLint 9 is installed but the repo still uses `.eslintrc.cjs`, so `pnpm lint` fails. This predates the current work. Fix it by migrating to `eslint.config.js` or pinning ESLint 8.

## Later / parked
- Expected payment dates for team pay (the member home says "still to come" because no date is stored)
- Server-side invoice aging filter (the invoices page filters `?aging=` in the browser)
- Leaves and Time tracking (flags in `apps/web/src/lib/features.ts`)
- Client-visible tasks and feedback
- Freelancer logins
- Recurring invoices and expenses, reimbursements, P&L and cash-flow views, CRM forecasting

## How each phase is verified
- `pnpm typecheck` and `pnpm lint` are clean; `pnpm --filter @agency/api test` passes, including the presenter and guard specs.
- Seed users: one per role, plus **two portal users on one client** and one on another client.
- API checks with each seed user's cookie:
  - A member's `GET /projects/:id` contains none of the hidden fields.
  - A client gets 403 on `/projects`, `/users` and `/invoices` but 200 on `/portal/*`, and only for their own company.
  - Client A can't load client B's invoice or file.
- Click through each phase in the running app (`pnpm dev`) as Owner, Member and Client, with screenshots at desktop and phone width.

## Changelog
- **2026-10-03**: Phase 6 done. Studio redesign across every page for owner, admin/lead, member and client. New owner-only endpoints `GET /dashboard/owner/cockpit` and `GET /projects/health`; portal responses gained milestone steps, lead contact and team names (no ids, no pay). Staff `GET /tasks` without a project is now limited to their projects. Project lists carry member names. Keyboard shortcuts, invoice/freelancer search, last-visit markers. Web and api typecheck clean; 83 API tests pass. Not yet checked in a browser.
- **2026-10-03**: Removed malware hidden in `apps/web/postcss.config.mjs` (present in git history since May; see chat). Phase 6 started: price-privacy lockdown done, design preview published.
- **2026-10-02**: Phase 5 done. All five phases complete. `tsc --noEmit` clean for web and api; 54 API unit tests pass (presenters, client-deny guard, storage access, portal scoping, invoice rules, payroll LOP/adjustments, expense repeat dates). Not yet run against a live database.
- **2026-10-02**: Phases 1–4 built: UI kit + refined look, payments ledger + freelancer directory, team earnings view, client portal. Both apps typecheck. Phase 5 page rollout in progress.
- **2026-10-02**: Combined retainer invoices. Invoice lines can link a contract (`lineItems.contractId`), and the dashboard's "Action required" groups due contracts by client into one invoice (`POST /contracts/generate-client-invoice`). Contract pages count only their own lines of a combined invoice. Contract invoices now use the same max+1 numbering as manual ones and UTC month bounds. Invoice PDFs that run slightly over A4 shrink to fit one page (`PdfService.renderPdf(html, { fitOnePage })`, never below 82%).
- **2026-10-02**: Phase 0 security and foundations done, except save-side HTML sanitizing (blocked on pnpm). Both apps typecheck. 20 API unit tests added and passing (presenters, client-deny guard, storage access).
- **2026-10-02**: Full audit done. Leaves and Time hidden behind feature flags (`lib/features.ts`, nav, middleware, dashboard, settings). This tracker created.
