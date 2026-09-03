# IH Seeds

Responsive pasture seed catalogue, weekly availability view, regional advice content, guide download, and persisted farmer enquiries for Irwin Hunter & Co.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/claude-design/src/`
- API routes: `artifacts/api-server/src/routes/`
- Database schema: `lib/db/src/schema/`
- API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- The site remains a single responsive, anchor-navigated experience to preserve the imported homepage structure.
- Catalogue and availability data come from PostgreSQL; the API seeds the imported catalogue only when the table is empty.
- Farmer enquiries are validated at the API boundary and persisted in PostgreSQL.

## Product

- Browse seed products and current availability.
- Search the catalogue and move through product groups.
- Read regional advice and download the 2026 pasture seed guide.
- Submit a saved advice enquiry from desktop or mobile.
- Use a brand-guideline-compliant mobile burger menu and touch-sized controls in the field.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
