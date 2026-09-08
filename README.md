# Revenant Cloud Web

React dashboard for Revenant Cloud.

**API is a separate repo:** [revenant-cloud](../revenant-cloud)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — API must be running at `VITE_API_URL` (default http://localhost:8080).

## Auth

- Login sets **httpOnly cookie** (`revenant_session`) + returns JWT in body
- Fetch uses `credentials: include` for CORS cookies
- `localStorage` token is fallback for dev tools / future API clients

## Types

`src/types/api.ts` must stay in sync with `revenant-cloud/packages/shared` until we publish OpenAPI codegen.

## Related

- **revenant-cloud** — Fastify API
- **revenant-cli** — restore validation engine
