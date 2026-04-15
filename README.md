# Freshwax

Freshwax is a self-hosted music release tracker with a Deezer-first catalog, Last.fm and Deezer import sources, optional TIDAL outbound links, background synchronization, and private iCalendar feeds.

## Features

- Local signup/signin with persistent sessions.
- Artist search against Deezer and per-user follow lists.
- Optional Last.fm username import to seed a watchlist from a user's top artists.
- Optional Deezer account linking to import the artists a user already follows there when existing OAuth credentials are available.
- Upcoming releases dashboard and a missed-recently feed for releases that surfaced after you started tracking an artist.
- Private `.ics` calendar feed per user.
- Redis-backed BullMQ worker for background synchronization.
- Dockerized deployment with PostgreSQL and Redis.

## Stack

- Next.js 16
- TypeScript
- PostgreSQL + Prisma
- Redis + BullMQ
- Tailwind CSS v4

## Quick start

1. Copy `.env.example` to `.env`.
2. Start the stack:

```bash
docker compose up --build
```

3. Open [http://localhost:3000](http://localhost:3000).
4. Create an account or run the seed locally for a demo user:

```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
```

Demo credentials after seeding:

- `demo@example.com`
- `demo12345`

## Local development

Run the services you need:

```bash
docker compose up postgres redis
```

Then in another shell:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

And in a third shell:

```bash
npm run dev:worker
```

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string for BullMQ.
- `APP_URL`: Base URL used in calendar links.
- `LASTFM_API_KEY`: Last.fm API key for username-based artist imports.
- `DEEZER_APP_ID`: Deezer application id for optional account linking and library import.
- `DEEZER_APP_SECRET`: Deezer application secret for optional account linking and library import.
- `SESSION_COOKIE_NAME`: Name of the auth cookie.
- `SESSION_TTL_DAYS`: Session duration.
- `SYNC_INTERVAL_MINUTES`: Repeat interval for full background sync scheduling.
- `DEFAULT_TIMEZONE`: Default timezone for new users.

## Deployment notes

- `docker compose up` builds one container image and runs it as a one-off `db-init` job, the web app, and the worker.
- Schema bootstrapping runs once in `db-init` via `prisma db push`, then `app` and `worker` start.
- The web container starts with `node .next/standalone/server.js` because the app uses Next standalone output.
- The Docker build copies `.next/static` and `public/` into `.next/standalone/` so static chunks are served correctly.
- Persistent Docker volumes are configured for PostgreSQL and Redis.

## Assumptions and limitations

- Deezer is used live for artist search and release metadata.
- Last.fm import is public-read only and resolves top artist names into Deezer artist matches.
- Deezer account import is optional and requires an existing Deezer app whose callback URL points to `/api/deezer/callback`.
- TIDAL enrichment is implemented as generated search URLs, not authenticated API synchronization.
- Deezer write-back actions such as following albums inside a user account are not implemented because the current integration only relies on stable read-side behavior.
- Last.fm imports intentionally skip artists that do not produce an exact normalized Deezer name match.
- Notification delivery is not implemented in v1, but notification candidates are persisted in `NotificationEvent` for recent missed releases.
- Release type detection is heuristic when provider metadata is incomplete.

Additional design notes live in [docs/architecture.md](/Users/robbert/tools/new-release-tracker/docs/architecture.md).
