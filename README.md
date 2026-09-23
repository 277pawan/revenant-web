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
| **[revenant-website](../revenant-website)** | Marketing site, docs, pricing, contact | React 19, Vite, Tailwind | Firebase → `revenant-verify-933e4.web.app` |
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

## Billing & access flow

1. **Register / sign in on the marketing site** (`revenant-website`) — not the cloud login for new orgs.
2. **Pay ₹1 on `/billing`** — Razorpay autopay setup (same JWT stored as `revenant_token`).
3. **Open cloud dashboard** — token is passed via `#token=` to `/auth/oauth/complete`; same session on both apps.

If cloud shows “Complete billing on revenant.dev”, the org has not finished ₹1 autopay setup yet.

### API migrations (required for billing)

After pulling API changes, from **`revenant-cloud`** (not this repo):

```bash
npm run db:migrate
```

If `create-order` returns 500 / `MIGRATION_REQUIRED`, the `billing_orders` table is missing — see [revenant-cloud README](../revenant-cloud/README.md#migrations--do-this-after-every-pull-fixes-500-on-billing--new-features).

---

## What this dashboard does

After sign-in, operators manage **restore proof** for PostgreSQL / AWS RDS fleets:

1. **Register** a database (direct Postgres or AWS RDS snapshot path).
2. **Define** validation plans (YAML checks — row counts, schemas, custom HTTP).
3. **Run** restore drills on a schedule or on demand.
4. **Collect** signed evidence (JSON + PDF certificates) in the vault.
5. **Alert** via Slack, email, or custom webhooks when drills fail.

Plans (**Starter / Pro / Enterprise**) gate parallel drills, self-hosted agents, and retention.

### Shipped capabilities (dashboard)

| Area | What users get |
|------|----------------|
| **Proof Composer** | AI-assisted `revenant.yaml` from schema paste or DB introspection (Mistral / OpenRouter on API) |
| **RBAC** | `admin` · `executor` · `viewer` — UI hides actions the role cannot perform |
| **Team invites** | Email invite → shareable link → accept on `/login?invite=…` |
| **Trial & billing UX** | `SubscriptionBanner` — trial countdown, paused state, link to marketing `/pricing` |
| **Drill modes** | `verify` (checks only) or `full` (AWS snapshot restore + verify) per workflow |
| **Live runs** | Run detail auto-refreshes while job is active; per-check results + pipeline graph |
| **Evidence export** | Download signed JSON + PDF certificate from run detail and evidence vault |
| **Integrations** | Slack incoming webhook, Gmail/SMTP alerts, signed custom HTTP webhooks |
| **Audit trail** | Searchable, paginated org audit log with JSON detail drawer |
| **Marketing cross-links** | Sidebar + login footer → docs, CLI, GitHub Action, marketing site (`lib/site.ts`) |
| **OAuth handoff** | Marketing site can sign in and redirect here with `#token=` on `/auth/oauth/complete` |

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
- **From marketing site:** `revenant-website` stores token and redirects to `/auth/oauth/complete#token=…` on this app.

**Also shipped:** `PasswordField` strength meter (`lib/passwordStrength.ts`), invite acceptance on login (`?invite=` token), animated auth brand panel (`AuthBrandPanel`, `OrbitingTeamOrbit`, `VerifyTerminal`).

---

### Dashboard

| Route | Page | Description |
|-------|------|-------------|
| `/` | `DashboardPage` | Fleet health (healthy / at risk / not tested), RTO trend chart, KPI cards, quick “run full drill” CTA |

**Components:** `RtoTrendChart`, `SubscriptionBanner`, plan-aware upsell, fleet table with last RTO and run links.

**Fleet health:** Each database row shows recovery mode, last status, RTO, and deep-links to the workflow or latest run.

---

### Databases

| Route | Page | Description |
|-------|------|-------------|
| `/databases` | `DatabasesPage` | List registered databases, connection status, recovery mode |
| `/databases/new` | `DatabaseWizardPage` | Multi-step wizard — engine, credentials, AWS RDS, validation plan |
| `/databases/:id/edit` | `DatabaseEditPage` | Edit connection, credentials, plan assignment |

**Components:** `DatabasePlanPicker`, `WizardStepper`, `SchemaPasteGuide`, `Field`, `AccordionSection`.

**Recovery modes:** `direct` (live Postgres) or `aws-rds` (snapshot restore drill via CLI).

**Wizard steps (4):** basics → connection → AWS / plan → review. **Starter plan** is AWS RDS restore drills only (`allowDirectPostgres` is false on Starter).

**From list view:** one-click “Run drill” enqueues a `full` restore job (permission: `jobs:run`).

---

### Workflows & runs

| Route | Page | Description |
|-------|------|-------------|
| `/workflows` | `WorkflowsListPage` | All databases with latest run status |
| `/workflows/:databaseId` | `WorkflowDetailPage` | Pipeline view, run history, trigger **verify** or **full** drill manually |
| `/workflows/:databaseId/runs/:jobId` | `RunDetailPage` | Live run — checks, RTO, JSON/PDF evidence download, React Flow restore graph |

**Components:** `WorkflowPipeline`, `RestorePipelineGraph`, `JobCheckList`, `StatusBadge`, `jobStatus`, `YamlEditor` (Monaco).

**Run detail:** Polls every 3s while job is running. Role-gated evidence download (`evidence:read`). Click a check row to inspect failure details.

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
| `/settings/general` | `GeneralSettingsPage` | Org name, plan & subscription overview |
| `/settings/credentials` | `CredentialsPage` | Encrypted DB passwords & AWS keys — rotate without viewing secrets |
| API Tokens | — | Coming soon (sidebar placeholder) |
| `/settings/validation-plans` | `ValidationPlansPage` | Reusable YAML templates + **Proof Composer** side panel |
| `/settings/team` | `TeamPage` | Members, roles, email invites (copy link), remove member |
| `/settings/runners` | `RunnersPage` | Self-hosted agent (**Pro+ only**) — issue token, `docker run` snippet with `VITE_AGENT_IMAGE` |
| `/settings/webhooks` | `WebhooksPage` | Slack, Gmail/SMTP email, signed HTTP — per-event subscriptions |
| `/settings/audit-log` | `AuditLogPage` | Searchable audit log, pagination, detail dialog |

**Components:** `WebhookEventPicker`, `IntegrationProviderIcon`, `CustomHttpGuide`, `AuditEventDetailDialog`, `PaginationBar`, `TableSearchBar`, `ConfirmDialog`.

### Proof Composer (`ValidationPlansPage`)

AI-assisted validation YAML — calls API `composeValidationYaml` when `MISTRAL_API_KEY` (or OpenRouter) is configured on the backend.

| Piece | Role |
|-------|------|
| `ProofComposer` | Layer toggles (schema, FKs, row counts, freshness, indexes, golden queries) |
| `SchemaPasteGuide` | Paste `information_schema` / `pg_dump --schema-only` output or upload `.sql` |
| `YamlEditor` | Monaco editor — review composed YAML before save |
| `AccordionSection` | Split left panel: plans list vs composer |

Shows “off” when composer is disabled on API; manual YAML editing always works.

### Roles & permissions (`types/api.ts`)

| Role | Typical use |
|------|-------------|
| **admin** | Full org control — databases, plans, webhooks, team, audit |
| **executor** | Run drills, edit validation plans, schedules — no team/webhook admin |
| **viewer** | Read-only — dashboards, evidence, run history |

UI gates buttons with `roleHasPermission()` (e.g. `jobs:run`, `databases:write`, `team:manage`).

### Plans & gating (`lib/plans.ts`)

| Plan | Managed AWS drills | Parallel drills | Self-hosted agent | Trial |
|------|-------------------|-----------------|-------------------|-------|
| **Starter** | ✅ 1 workflow | 1 | ❌ | 30 days |
| **Pro** | ✅ up to 10 | 3 | ✅ (private VPC) | — |
| **Enterprise** | ✅ fair use | unlimited | ✅ | — |

`SubscriptionBanner` surfaces trial days left or “subscribe on website”. `RunnersPage` hidden unless `planAllowsSelfHostedAgent()`.

### Integrations (`WebhooksPage` + `lib/integrations.ts`)

| Provider | Config in UI | Events |
|----------|--------------|--------|
| **Slack** | Incoming webhook URL | `job.pass`, `job.fail`, `job.error` |
| **Email** | Gmail + app password, recipient list | Same job events + weekly digest (API) |
| **HTTP** | URL + signing secret (`X-Revenant-Signature`) | Same — see `CustomHttpGuide` |

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
| Site URLs | `lib/site.ts`, `lib/env.defaults.ts` | API, app, marketing links — production defaults baked in |
| Integrations copy | `lib/integrations.ts` | Provider labels and setup hints |
| Webhook events | `lib/webhook-events.ts` | Human labels for `job.pass` / `job.fail` / `job.error` |
| Workflow helpers | `lib/workflow.ts` | Slugs, duration formatting |
| Audit labels | `lib/audit.ts` | Audit action display names |
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
| `/login`, `/register` | OAuth + email | Same API as dashboard; redirects to cloud app after sign-in |
| `/cli` | `CliPage` | Install, quick start, command reference |
| `/talk`, `/coffee` | Contact forms | POST → API `/api/v1/public/contact` |

**Production URL:** https://revenant-verify-933e4.web.app

**Marketing-specific:**
- `lib/engagement.ts` — tracks visits, hero views, logins to API (`/api/v1/public/engagement`).
- `lib/site.ts` + `lib/env.defaults.ts` — production API/app URLs baked into build (no localhost in prod).
- `lib/seo.ts`, `PageMeta` — per-page SEO, JSON-LD, auto-generated sitemap (39 URLs).
- Semantic theme in `theme.css` + Tailwind tokens (gold accent on dark background).

**Cross-app auth:** After marketing login/register, `goToAppWithSession()` redirects to  
`https://revenant-cloud-web.web.app/auth/oauth/complete#token=…`

**Cross-links from this dashboard:** AppShell sidebar → marketing docs, CLI page, GitHub Action repo, marketing home.

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

| Variable | Default (dev) | Description |
|----------|---------------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_SITE_URL` | `http://localhost:5173` | This dashboard’s public URL (OAuth return) |
| `VITE_MARKETING_URL` | `http://localhost:3000` | Marketing site — docs/pricing/billing links |
| `VITE_AGENT_IMAGE` | `277pawan/revenant-agent:latest` | Docker image shown on Runners page |

Production fallbacks live in `src/lib/env.defaults.ts` (used when env vars are unset at build time).

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

**CI build env** (`.github/workflows/firebase-hosting-*.yml`):

| Variable | Production value |
|----------|------------------|
| `VITE_API_URL` | `https://revenant-api-171384186168.asia-south1.run.app` |
| `VITE_SITE_URL` | `https://revenant-cloud-web.web.app` |
| `VITE_MARKETING_URL` | `https://revenant-verify-933e4.web.app` |

| Secret | Purpose |
|--------|---------|
| `FIREBASE_SERVICE_ACCOUNT_REVENANT_CLOUD_WEB` | Firebase deploy *(set by Firebase CLI)* |

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

API must allow frontend origins in `CORS_ORIGIN` (see `revenant-cloud/scripts/production-cors.txt`):
```
https://revenant-cloud-web.web.app,https://revenant-cloud-web.firebaseapp.com,https://revenant-verify-933e4.web.app,https://revenant-verify-933e4.firebaseapp.com,http://localhost:5173,http://localhost:3000
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
│   ├── api.ts              # HTTP client (+ Proof Composer, team, audit APIs)
│   ├── auth.tsx            # Auth context
│   ├── site.ts             # Marketing / docs / pricing URLs
│   ├── env.defaults.ts     # Production URL fallbacks
│   ├── oauth-popup.ts      # Google/GitHub popup flow
│   ├── plans.ts            # Plan definitions + trial helpers
│   ├── integrations.ts     # Webhook provider metadata
│   ├── passwordStrength.ts # Register password meter
│   └── forms/              # Zod schemas (database wizard, etc.)
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
