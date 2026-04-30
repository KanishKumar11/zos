# Agency Management Panel

Internal agency operations platform — team, payroll, projects, tasks, SOW, clients, invoices.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui, React Query v5, Zustand
- **Backend:** NestJS 10, Mongoose, JWT, Puppeteer, S3
- **Database:** MongoDB
- **Monorepo:** Turborepo + pnpm workspaces

## Bootstrap

```bash
# 1. Install
pnpm install

# 2. Start local services (Mongo, Mailhog, MinIO)
docker compose up -d

# 3. Configure env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Seed initial owner + defaults
pnpm seed

# 5. Dev
pnpm dev
```

## Workspace layout

```
apps/
  web/      Next.js 16 frontend
  api/      NestJS backend
packages/
  shared/   Zod schemas + enums shared between web and api
```

## Commands

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `pnpm dev`         | Run web + api in parallel         |
| `pnpm build`       | Build all packages                |
| `pnpm lint`        | Lint all packages                 |
| `pnpm typecheck`   | TS typecheck all packages         |
| `pnpm test`        | Unit tests                        |
| `pnpm test:e2e`    | E2E tests (api)                   |
| `pnpm seed`        | Seed initial data                 |
| `pnpm format`      | Prettier write                    |

See [docs/PRD.md](../docs/PRD.md) for product requirements.

## Modules shipped

| Area | Highlights |
| ---- | ---------- |
| Auth | JWT (access + refresh cookie), token versioning, role guards |
| Settings & Holidays | Org-wide config, weekend days, holiday calendar |
| Team | Users, roles, invites, soft-delete |
| Compensation (OWNER) | Per-user comp profiles + history |
| Attendance | Check-in/out, monthly grid, admin mark-up, working-day calc |
| Leaves | Apply / approve / reject + balance bookkeeping |
| Payroll | Run drafts, recompute, finalize, payslips with breakdown |
| Announcements | Audience targeting (ALL/ROLE/DEPT/USERS) + notification fanout |
| Notifications | Per-user inbox, mark-read, polled unread counter |
| Projects | Members, briefs; OWNER-only client / budget / margin fields |
| Tasks | Status, priority, comments, time entries |
| SOW (OWNER) | Milestones, signed date, document keys |
| Clients & CRM (OWNER) | Pipeline by CrmStage with positional ordering |
| Invoices (OWNER) | Line items, GST, payments, hourly overdue cron |
| Dashboard | Owner & member widgets |
| Audit log | Event-driven writes; OWNER + ADMIN read-only UI |
| Infra | CI workflow, Dockerfiles for api & web |

