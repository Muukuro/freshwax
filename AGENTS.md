# AGENTS.md

## Critical framework note

This repo uses **Next.js 16 App Router**. Do not assume older Next.js behavior.

- Before changing routing, server actions, cookies, headers, or route handlers, check the relevant docs in `node_modules/next/dist/docs/`.
- Prefer existing repo patterns over generic Next.js habits.

## Product context

This project is a self-hosted music release tracker with:

- local email/password auth
- Deezer artist search and release metadata
- optional TIDAL outbound links
- per-user followed artists, discovery feed, and ignore state
- a private iCalendar feed per user
- BullMQ + Redis background sync
- PostgreSQL + Prisma canonical data model

The goal is a working self-hosted product, not a demo or admin panel.

## Stack

- Next.js 16 + TypeScript
- Prisma + PostgreSQL
- BullMQ + Redis
- Tailwind CSS v4 via `src/app/globals.css`

## Important paths

- `src/app/`: App Router pages, layouts, route handlers, server actions
- `src/app/actions/`: server mutations for auth, follows, settings
- `src/app/api/`: JSON endpoints
- `src/app/calendar/[token]/route.ts`: ICS feed endpoint, rewritten from `/calendar/:token.ics`
- `src/components/`: shared UI components
- `src/lib/`: auth, data access, provider integration, sync logic, queue setup
- `src/worker.ts`: BullMQ worker entrypoint
- `prisma/schema.prisma`: source of truth for the data model
- `prisma/seed.ts`: local demo seed
- `docker-compose.yml`, `Dockerfile`, `docker/entrypoint.sh`: self-hosted runtime
- `docs/architecture.md`: architecture decisions and known limitations

## Existing architecture

### Auth

- Session auth is custom and cookie-based.
- Main auth logic lives in `src/lib/auth.ts`.
- Signup/signin/signout server actions live in `src/app/actions/auth.ts`.
- Do not introduce a third-party auth system unless explicitly requested.

### Data model

- Canonical artists and releases are stored separately from provider mappings.
- Provider-specific ids belong in `ArtistProviderMapping` and `ReleaseProviderMapping`.
- User-specific state belongs in per-user tables like `UserFollow`, `DiscoveryEvent`, `IgnoredRelease`, and `CalendarToken`.
- If you add a feature that is user-visible, think carefully about whether it is global canonical data or per-user derived state.

### Sync and providers

- Deezer is the primary live catalog source.
- Deezer integration lives in `src/lib/providers/deezer.ts`.
- TIDAL is currently a generated search-link fallback in `src/lib/providers/tidal.ts`.
- Core sync logic lives in `src/lib/sync.ts`.
- Queue setup is intentionally lazy in `src/lib/queue.ts` so `next build` does not connect to Redis during import.
- If you change queue code, preserve that lazy behavior.

### Calendar feed

- The route implementation is `src/app/calendar/[token]/route.ts`.
- Public URL shape is `/calendar/:token.ics`, provided via a rewrite in `next.config.ts`.
- UID stability matters. Do not switch to random event ids.
- Feed contents should stay aligned with user filters and ignore state.

## Working rules for this repo

### When editing data flows

- Prefer changing the shared data access helpers in `src/lib/data.ts` instead of duplicating query logic in pages.
- Keep UI pages mostly thin and server-rendered.
- Use server actions for authenticated mutations unless there is a clear reason to expose an API route.

### When editing schema

- Update `prisma/schema.prisma`.
- Regenerate Prisma client with `npx prisma generate`.
- Validate with `npx prisma validate`.
- Keep the schema pragmatic. Avoid speculative tables unless they support a real user flow.

### When editing UI

- Preserve the current visual language: warm metallic accent, dark layered background, rounded panels, product-like dashboard feel.
- Do not turn the app into a generic CRUD admin.
- Prefer extending existing components before adding one-off markup everywhere.

### When editing providers

- Assume Deezer metadata can be incomplete or inconsistent.
- Best-effort heuristics are acceptable, but document notable limitations.
- The app must degrade gracefully if a provider response is partial or missing.
- Deezer authenticated write-back should be treated as optional operator-supplied capability only.
- Do not assume new Deezer developer applications can be created; if a feature needs Deezer OAuth credentials, design it to work only when the operator already has an existing Deezer app.
- Prefer read-side Deezer integrations and local in-app actions over Deezer library mutations unless the required credentials and endpoint behavior are confirmed.

### When editing Docker/runtime

- Keep self-hosting simple.
- Do not add infrastructure that makes `docker compose up` materially harder to run.
- The current container entrypoint uses `prisma db push` for first-run schema bootstrapping. If you change that flow, also update `README.md`.

## Verification checklist

For meaningful changes, run as many of these as apply:

- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`

If you change schema or local setup behavior, also verify:

- `npx prisma db push`
- `npm run prisma:seed`

If Redis/Postgres-backed behavior changes, verify both app and worker paths when possible.

## Common pitfalls

- Do not eagerly create Redis connections at module import time.
- Do not break the `.ics` URL shape while refactoring the route.
- Do not move user-specific state into canonical release records.
- Do not assume TIDAL has authoritative ids in the current implementation.
- Do not replace local auth with a heavier system without a user request.

## Documentation expectations

If you make a meaningful architectural or operational change, update:

- `README.md` for setup or runtime changes
- `docs/architecture.md` for design decisions or limitations

Keep docs aligned with the actual code, not intended future state.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `Muukuro/freshwax`. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout. See `docs/agents/domain.md`.
