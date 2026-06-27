# Freshwax

Freshwax is a self-hosted music release tracker for people who want a clean, personal watchlist instead of another streaming-platform inbox.

It keeps a canonical list of artists and releases, lets each user follow artists with their own filters and preferences, syncs release metadata in the background, and exposes a private iCalendar feed for the releases that matter to them.

## Why Freshwax

- Self-hosted and operator-friendly
- Local email/password auth built in
- Works without mandatory third-party platform credentials
- MusicBrainz-backed catalog search and release discovery
- Optional streaming platform links, account connections, and imports where implemented
- Deezer public API fallback and enrichment when mappings are available
- Private per-user release calendar feeds
- Background sync with BullMQ + Redis
- PostgreSQL + Prisma data model designed for long-lived canonical records

## What It Does

Freshwax is built around a simple idea: global release data should stay canonical, while visibility and follow state should stay personal.

Each user gets their own followed artists, recent-release feed, ignore state, notification preferences, timezone-aware release filtering, and tokenized calendar feed. The app stays server-rendered and product-focused rather than turning into a generic admin dashboard.

## Feature Highlights

- Artist search backed by MusicBrainz, with Deezer used as a public fallback/enrichment source
- Per-user follows, recent-release feed, and ignore state
- Recent-first release browsing with a separate upcoming-release planning view
- Private `.ics` feed per user, exposed at `/calendar/:token.ics`
- Optional browser push notifications and signed webhook delivery
- Installable PWA shell with app manifest, home-screen icons, and an offline fallback page
- Optional Last.fm import to seed a watchlist from listening history
- Optional external login and account-link flows for supported providers
- Background sync worker with lazy queue setup so app builds do not connect to Redis during import
- Docker-based runtime with PostgreSQL, Redis, web app, worker, and first-run schema bootstrapping

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma
- PostgreSQL
- BullMQ
- Redis
- Tailwind CSS v4

## Quick Start

### Run with the Published Docker Image

Download the image-based Compose file and start Freshwax:

```bash
curl -fsSLO https://raw.githubusercontent.com/Muukuro/freshwax/main/docker-compose.image.yml
docker compose -f docker-compose.image.yml up -d
```

That uses `ghcr.io/muukuro/freshwax:latest` and starts the app, worker, PostgreSQL, Redis, and first-run schema bootstrapping.

If you already have PostgreSQL and Redis:

```bash
docker run -d --name freshwax -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@postgres-host:5432/freshwax?schema=public" \
  -e REDIS_URL="redis://redis-host:6379" \
  ghcr.io/muukuro/freshwax:latest
```

For public deployments, set `APP_URL` to the public origin, for example `https://freshwax.example.com`, so calendar links, notifications, and OAuth callbacks use the right URL.

### Run from Source with Docker Compose

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Start the full stack:

```bash
docker compose up --build
```

3. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

That builds the local source image and launches:

- `postgres`
- `redis`
- `db-init` running `prisma db push`
- the Next.js app
- the BullMQ worker

Freshwax works without third-party provider credentials. For a minimal setup, `DATABASE_URL`, `REDIS_URL`, and `APP_URL` are the only required values.

### Seed Demo Data

If you want a local demo account:

```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
```

Demo credentials:

- `demo@example.com`
- `demo12345`

## Local Development

Start PostgreSQL and Redis:

```bash
docker compose up postgres redis
```

Then run the app and worker locally:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev:all
```

Useful alternatives:

```bash
npm run dev
npm run dev:worker
```

## Configuration

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string for BullMQ
- `APP_URL`: Public base URL used for calendar links, notifications, and OAuth callbacks

For local development, prefer `http://127.0.0.1:3000` over `localhost`. Some OAuth providers reject `localhost` redirect URIs.

### Common Optional Settings

- `LASTFM_API_KEY`: Enables Last.fm username import
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`: Enable browser push notifications
- `NOTIFICATION_WEBHOOK_URL`: Enables instance-wide webhook delivery
- `NOTIFICATION_WEBHOOK_SECRET`: Signs webhook payloads with HMAC-SHA256
- `SYNC_INTERVAL_MINUTES`: Full background sync interval
- `ARTIST_SYNC_CONCURRENCY`: Worker concurrency for artist sync jobs
- `DEFAULT_TIMEZONE`: Default timezone for new users

### Optional Provider Credentials

- `DEEZER_APP_ID`, `DEEZER_APP_SECRET`
- `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`

These enable optional login, linking, or import flows. Core release tracking does not depend on them.

## Deployment Notes

- The app uses Next.js standalone output in containers
- `docker compose up` runs schema bootstrapping with `prisma db push` before app and worker startup
- Published images are available from `ghcr.io/muukuro/freshwax`; use exact semver tags for repeatable production installs
- Queue setup is intentionally lazy so `next build` does not create Redis connections at import time
- The public calendar URL shape remains `/calendar/:token.ics`, backed by a rewrite to the App Router route
- PWA support is served from the app itself: `/manifest.webmanifest`, generated app icons, and `/push-sw.js`. Browser push subscriptions and offline caching intentionally share that service worker URL.

## Architecture

Freshwax separates:

- canonical artists and releases
- provider-specific mappings
- per-user state such as follows, discovery events, ignored releases, calendar tokens, and notification settings

That separation keeps provider data replaceable and lets user-visible behavior stay user-specific instead of mutating shared release records.

## Verification

For meaningful changes in this repo, the standard checks are:

```bash
npm run lint
npm run build
npx prisma validate
npx prisma generate
```

If schema or setup behavior changes, also run:

```bash
npx prisma db push
npm run prisma:seed
```

## Documentation

- Setup and operator details: [docs/setup.md](docs/setup.md)
- Architecture notes: [docs/architecture.md](docs/architecture.md)

## Current Scope and Limitations

- MusicBrainz is the canonical identity and release-discovery source
- Streaming platform integrations are optional and additive; Deezer is not required for core tracking
- Deezer metadata can be incomplete and is used as best-effort public fallback/enrichment when mappings are available
- TIDAL is currently used for outbound links and optional account-linked import paths
- Some provider surfaces appear in preferences before full end-to-end support exists
- Release typing and provider matching rely on best-effort heuristics where source metadata is inconsistent

## License

Freshwax is licensed under the GNU Affero General Public License v3.0 or later.
See [LICENSE](LICENSE).
