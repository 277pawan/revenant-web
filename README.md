# Revenant Cloud Web

React dashboard for **Revenant Cloud** — the control plane where teams register databases, run restore drills, collect evidence, and prove backups actually recover before an outage.

> **Revenant** answers one question: *did your last backup really restore?*

---

## The Revenant platform

Revenant is split across several repos that work together:

| Repo | Role | Stack | Production |
|------|------|-------|------------|
| **[revenant-cloud-web](.)** (this repo) | Product dashboard — login, fleet, workflows, evidence | React 19, Vite, Tailwind | Firebase Hosting → `revenant-cloud-web.web.app` |
| **[revenant-cloud](../revenant-cloud)** | REST API, auth, jobs, schedules, webhooks | Fastify, Drizzle, PostgreSQL | Google Cloud Run → `revenant-api-*.asia-south1.run.app` |
| **[revenant-website](../revenant-website)** | Marketing site, docs, pricing, contact | React 19, Vite, Tailwind | Separate Firebase / static host |
| **[revenant-cli](../revenant-cli)** | CLI restore-validation engine (`revenant verify`) | Go | Runs locally or in customer CI |

```
┌─────────────────────┐     ┌─────────────────────┐
│  revenant-website   │     │  revenant-cloud-web │  ← you are here
│  (marketing)        │     │  (dashboard)        │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          └───────────┬───────────────┘
                      │ HTTPS + CORS
                      ▼
          ┌───────────────────────┐
          │   revenant-cloud API   │
          │   (Fastify + Postgres) │
          └───────────┬───────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   Neon / Postgres          revenant-cli
   (control-plane DB)       (restore drills)
```

---

## What this dashboard does

After sign-in, operators manage **restore proof** for PostgreSQL / AWS RDS fleets:

1. **Register** a database (direct Postgres or AWS RDS snapshot path).
2. **Define** validation plans (YAML checks — row counts, schemas, custom HTTP).
3. **Run** restore drills on a schedule or on demand.
4. **Collect** signed evidence (JSON + PDF certificates) in the vault.
5. **Alert** via Slack, email, or custom webhooks when drills fail.

Plans (**Starter / Pro / Enterprise**) gate parallel drills, self-hosted agents, and retention.

---

## Modules (routes & features)

### Authentication

| Route | Page | Description |
|-------|------|-------------|
| `/login` | `LoginPage` | Email/password, Google & GitHub OAuth (popup flow), invite acceptance |
| `/register` | *(via login)* | Create organization (Starter plan by default) |
| `/forgot-password` | `ForgotPasswordPage` | Email reset link |
| `/reset-password` | `ResetPasswordPage` | Set new password from token |
| `/auth/oauth/complete` | `OAuthCompletePage` | Popup callback — receives JWT, posts to opener |

**Auth components:** `AuthBrandPanel`, `OAuthButtons`, `OrbitingTeamOrbit`, `BackupResurrection`, `VerifyTerminal`, `PasswordField`, `AuthSuccessOverlay`.

**How auth works:**
- API returns JWT in login/OAuth response → stored in `localStorage` (`revenant_token`).
- API also sets httpOnly session cookie when applicable.
- `lib/auth.tsx` wraps `/api/v1/me` for session restore.
- OAuth uses `lib/oauth-popup.ts` — popup opens API OAuth URL, completes on `/auth/oauth/complete`, `postMessage` back to login page.

---

### Dashboard

| Route | Page | Description |
|-------|------|-------------|
| `/` | `DashboardPage` | Fleet health summary, RTO trends, recent runs, workflow status cards |

**Components:** `RtoTrendChart`, `SubscriptionBanner`, plan-aware upsell.

---

### Databases

| Route | Page | Description |
|-------|------|-------------|
| `/databases` | `DatabasesPage` | List registered databases, connection status, recovery mode |
| `/databases/new` | `DatabaseWizardPage` | Multi-step wizard — engine, credentials, AWS RDS, validation plan |
| `/databases/:id/edit` | `DatabaseEditPage` | Edit connection, credentials, plan assignment |

**Components:** `DatabasePlanPicker`, `WizardStepper`, `SchemaPasteGuide`, `Field`, `AccordionSection`.

**Recovery modes:** `direct` (live Postgres) or `aws-rds` (snapshot restore drill via CLI).

---

### Workflows & runs

| Route | Page | Description |
|-------|------|-------------|
| `/workflows` | `WorkflowsListPage` | All databases with latest run status |
| `/workflows/:databaseId` | `WorkflowDetailPage` | Pipeline view, run history, trigger manual drill |
| `/workflows/:databaseId/runs/:jobId` | `RunDetailPage` | Single run — checks, logs, evidence download, React Flow graph |

**Components:** `WorkflowPipeline`, `RestorePipelineGraph`, `JobCheckList`, `StatusBadge`, `jobStatus`, `ProofComposer`, `YamlEditor` (Monaco).

`/jobs/:id` redirects to the new workflow run URL (legacy).

---

### Schedules

| Route | Page | Description |
|-------|------|-------------|
| `/schedules` | `SchedulesPage` | Cron schedules per database — auto-enqueue restore drills |

**Components:** `ScheduleTimingFields`, `WorkflowPicker`.

---

### Evidence vault

| Route | Page | Description |
|-------|------|-------------|
| `/evidence` | `EvidenceVaultPage` | Archived proof artifacts — PDF certificates + JSON, filter by database |

---

### Settings

| Route | Page | Description |
|-------|------|-------------|
| `/settings/validation-plans` | `ValidationPlansPage` | Reusable YAML validation templates |
| `/settings/team` | `TeamPage` | Members, roles, invites |
| `/settings/runners` | `RunnersPage` | Self-hosted agent (Pro+) — issue runner token, Docker snippet |
| `/settings/webhooks` | `WebhooksPage` | Slack, email, custom HTTP integrations |
| `/settings/audit-log` | `AuditLogPage` | Immutable audit trail |

**Coming soon (sidebar placeholders):** General, Credentials, API Tokens.

**Components:** `WebhookEventPicker`, `IntegrationProviderIcon`, `CustomHttpGuide`, `AuditEventDetailDialog`, `PaginationBar`, `TableSearchBar`.

---

## Shared UI & infrastructure

| Area | Location | Notes |
|------|----------|-------|
| Layout | `AppShell.tsx` | Dark sidebar, plan badge, main + settings nav |
| Toasts | `toast/ToastProvider.tsx` | Success / error / info notifications |
| Forms | `react-hook-form` + `zod` | e.g. `lib/forms/database.schema.ts` |
| API client | `lib/api.ts` | All `/api/v1/*` calls, Bearer token, `credentials: include` |
| Types | `types/api.ts` | Mirror of `revenant-cloud/packages/shared` |
| Plans | `lib/plans.ts` | Starter / Pro / Enterprise definitions for UI |
| Datetime | `lib/datetime.ts`, `DateTimeText.tsx` | Consistent timestamps |

---

## Marketing website (`revenant-website`)

Separate repo — public-facing, dark theme, same API for auth.

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `HomePage` | Hero, features, demo, CLI showcase, pricing preview |
| `/pricing` | `PricingPage` | Starter / Pro / Enterprise |
| `/cli` | `CliPage` | `revenant verify` documentation |
| `/docs` | `DocsIndexPage` | Documentation hub |
| `/docs/:section/:module` | `DocsModulePage` | Getting started, CLI, cloud, AWS sections |
| `/talk` | `TalkPage` | Contact / sales form → API `/api/v1/public/contact` |
| `/coffee` | `CoffeePage` | Support / fund form |
| `/login`, `/register` | OAuth + email | Same API as dashboard; redirects to app after sign-in |

**Marketing-specific:**
- `lib/engagement.ts` — tracks visits, hero views, logins to API (`/api/v1/public/engagement`).
- `lib/site.ts` — `VITE_SITE_URL`, `VITE_API_URL`, `VITE_APP_URL`.
- Semantic theme in `theme.css` + Tailwind tokens (gold accent on dark background).

After marketing login, `goToAppWithSession()` sends users to the cloud dashboard URL.

---

## Local development

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (local control-plane DB)
- [revenant-cloud](../revenant-cloud) API running on port **8080**

### Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_AGENT_IMAGE` | `277pawan/revenant-agent:latest` | Docker image shown on Runners page |

### Backend (separate terminal)

```bash
cd ../revenant-cloud
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Verify: `curl http://localhost:8080/health`

---

## Production deployment

### Frontend (this repo) — Firebase Hosting

| Item | Value |
|------|-------|
| Firebase project | `revenant-cloud-web` |
| Live URL | https://revenant-cloud-web.web.app |
| CI | GitHub Actions on push to `main` |

**GitHub secret required:**

| Secret | Example |
|--------|---------|
| `VITE_API_URL` | `https://revenant-api-171384186168.asia-south1.run.app` |
| `FIREBASE_SERVICE_ACCOUNT_REVENANT_CLOUD_WEB` | *(set by Firebase CLI)* |

```bash
npm run build
firebase deploy --only hosting --project revenant-cloud-web
```

### Backend — Google Cloud Run

| Item | Value |
|------|-------|
| GCP project | `revenant-cloud` |
| Service | `revenant-api` |
| Region | `asia-south1` (Mumbai) |
| Database | Neon Postgres (`revenant_cloud`) |

```bash
cd ../revenant-cloud
./scripts/deploy-cloud-run.sh
```

API must allow the frontend origin in `CORS_ORIGIN`:
```
https://revenant-cloud-web.web.app,https://revenant-cloud-web.firebaseapp.com
```

---

## Project structure

```
src/
├── App.tsx                 # Routes + protected route guard
├── main.tsx
├── index.css               # Global styles, auth animations
├── pages/                  # One file per screen (see modules above)
├── components/
│   ├── AppShell.tsx        # Dashboard chrome
│   ├── auth/               # Login shell, OAuth, brand panels
│   ├── workflow/           # Pipeline graphs, job status
│   ├── toast/              # Toast provider
│   └── ui/                 # Field, Button, AccordionSection
├── lib/
│   ├── api.ts              # HTTP client
│   ├── auth.tsx            # Auth context
│   ├── oauth-popup.ts      # Google/GitHub popup flow
│   ├── plans.ts            # Plan definitions
│   └── forms/              # Zod schemas
├── hooks/
└── types/
    └── api.ts              # API types (keep in sync with backend shared package)
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | `tsc` only |

---

## Keeping types in sync

`src/types/api.ts` should match **`revenant-cloud/packages/shared`**. When the API adds or changes DTOs, update both (or add OpenAPI codegen later).

---

## Related repos

- **[revenant-cloud](../revenant-cloud)** — Fastify API, Drizzle schema, Cloud Run Dockerfile
- **[revenant-website](../revenant-website)** — Marketing site + docs
- **[revenant-cli](../revenant-cli)** — Restore validation CLI used by runners

---

## License

Private — Revenant / Pawan Bisht.
