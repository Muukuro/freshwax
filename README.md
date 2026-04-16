# Freshwax

Freshwax is a self-hosted music release tracker with platform-aware preferences, provider-neutral artist following, optional external login, background synchronization, and private iCalendar feeds.

## Features

- Local signup/signin with persistent sessions plus optional external provider login where configured.
- First-run onboarding to choose favorite platforms, import defaults, and link visibility.
- Provider-neutral artist search with canonical matching and per-user follow lists.
- Optional Last.fm username import to seed a watchlist from artists above a per-user minimum listen threshold.
- Optional platform account linking and config-gated import paths.
- Upcoming releases dashboard and a missed-recently feed for releases that surfaced after you started tracking an artist.
- Private `.ics` calendar feed per user.
- Redis-backed BullMQ worker for background synchronization that also gets nudged automatically from authenticated app visits when the watchlist is stale.
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
npm run dev:all
```

This starts the Next.js app in HMR mode and the BullMQ worker in watch mode. If you only need one side, the individual commands are still available:

```bash
npm run dev
npm run dev:worker
```

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string for BullMQ. For host-local development against the Compose Redis service, use `redis://localhost:6380`. Compose services override this internally to `redis://redis:6379`.
- `APP_URL`: Base URL used in calendar links.
- `LASTFM_API_KEY`: Last.fm API key for username-based artist imports.
- `DEEZER_APP_ID`: Deezer application id for optional account linking and library import.
- `DEEZER_APP_SECRET`: Deezer application secret for optional account linking and library import.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`: Spotify OAuth credentials for optional external login and account linking.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth credentials backing YouTube Music-branded login.
- `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`: Login with Amazon credentials for Amazon Music-branded login.
- `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`: TIDAL OAuth credentials for external login and account linking.
  Required TIDAL app scopes: `user.read`, `collection.read`, and `collection.write`.
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: Reserved for Sign in with Apple.
- `APPLE_MUSIC_DEVELOPER_TOKEN`: Reserved for MusicKit account linking.
- `DEEZER_RATE_LIMIT_RETRIES`: Number of Deezer quota-limit retries before a request or sync job is allowed to fail.
- `DEEZER_RATE_LIMIT_BASE_DELAY_MS`: Base cooldown in milliseconds used for exponential Deezer retry backoff.
- `SESSION_COOKIE_NAME`: Name of the auth cookie.
- `SESSION_TTL_DAYS`: Session duration.
- `SYNC_INTERVAL_MINUTES`: Repeat interval for full background sync scheduling. Authenticated app visits can also queue a catch-up sync sooner when nothing has run recently.
- `ARTIST_SYNC_CONCURRENCY`: Number of artist sync jobs the worker should process in parallel. Keep this low to avoid Deezer quota bursts.
- `DEFAULT_TIMEZONE`: Default timezone for new users.

## Deployment notes

- `docker compose up` builds one container image and runs it as a one-off `db-init` job, the web app, and the worker.
- Schema bootstrapping runs once in `db-init` via `prisma db push`, then `app` and `worker` start.
- The web container starts with `node .next/standalone/server.js` because the app uses Next standalone output.
- The Docker build copies `.next/static` and `public/` into `.next/standalone/` so static chunks are served correctly.
- Persistent Docker volumes are configured for PostgreSQL and Redis.

## Assumptions and limitations

- MusicBrainz is the default canonical artist search layer, with Deezer enrichment when available.
- Last.fm import is public-read only and resolves artist names into canonical artists first, then attaches provider mappings opportunistically.
- Deezer account import is optional and requires an existing Deezer app whose callback URL points to `/api/deezer/callback`.
- Deezer quota-limit responses are retried with exponential backoff and artist syncs default to single-job concurrency so large imports can drain instead of failing immediately.
- Spotify, YouTube Music, Amazon Music, TIDAL, Apple Music, and Deezer all appear in platform preferences, but not every provider has a complete import/login implementation yet.
- TIDAL login/account linking is implemented with PKCE. The TIDAL app should include the redirect URI `/api/auth/tidal/callback` and enable `user.read`, `collection.read`, and `collection.write`.
- YouTube Music, Amazon Music, and Apple Music still behave as capability-gated or partial providers in parts of the product.
- Deezer write-back actions such as following albums inside a user account are not implemented because the current integration only relies on stable read-side behavior.
- Notification delivery is not implemented in v1, but notification candidates are persisted in `NotificationEvent` for recent missed releases.
- Release type detection is heuristic when provider metadata is incomplete.

Additional design notes live in [docs/architecture.md](/Users/robbert/tools/freshwax/docs/architecture.md).
