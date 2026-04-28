# Setup Guide

This guide covers the full operator setup for Freshwax:

- required runtime dependencies
- environment variables
- OAuth and app-registration setup for optional providers
- browser push and webhook notifications
- local and production run modes

Freshwax works without any third-party provider credentials. PostgreSQL, Redis, and a correct `APP_URL` are the only hard requirements.

## 1. Prerequisites

Required:

- Node.js 22.x and npm
- PostgreSQL
- Redis

Recommended local baseline:

- Docker Desktop or another Docker engine for running PostgreSQL and Redis locally
- `APP_URL=http://127.0.0.1:3000` for local development

Why `127.0.0.1` instead of `localhost`:

- Freshwax builds OAuth callback URLs from `APP_URL`.
- Spotify requires loopback IP literals for local redirect URIs and does not allow `localhost`.
- Using `127.0.0.1` locally avoids provider-specific redirect mismatches.

## 2. Environment File

Start from `.env.example`:

```bash
cp .env.example .env
```

These variables matter most:

### Required

- `DATABASE_URL`: PostgreSQL connection string used by Prisma and the app.
- `REDIS_URL`: Redis connection string used by BullMQ.
- `APP_URL`: Absolute base URL for calendar links, notifications, and OAuth callbacks.

### Optional but commonly useful

- `LASTFM_API_KEY`: Enables Last.fm username imports.
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`: Enable browser push delivery.
- `NOTIFICATION_WEBHOOK_URL`: Sends instance-wide release webhooks.
- `NOTIFICATION_WEBHOOK_SECRET`: HMAC secret for `x-freshwax-signature`.

### Optional provider credentials

- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`
- `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`
- `DEEZER_APP_ID`, `DEEZER_APP_SECRET`

### Reserved / not fully wired for end-user auth yet

- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- `APPLE_MUSIC_DEVELOPER_TOKEN`

Apple Music appears in platform preferences, but the external auth callback flow is not implemented in the app today. Leave these empty unless you are actively extending that integration.

### Operational tuning

- `SESSION_COOKIE_NAME`: Session cookie name. Default: `nrt_session`
- `SESSION_TTL_DAYS`: Session lifetime in days
- `SYNC_INTERVAL_MINUTES`: Recurring full-sync interval. Default: `360`
- `ARTIST_SYNC_CONCURRENCY`: Worker sync concurrency. Default: `1`
- `DEEZER_RATE_LIMIT_RETRIES`: Deezer retry count before failure
- `DEEZER_RATE_LIMIT_BASE_DELAY_MS`: Base exponential backoff for Deezer quota responses
- `DEFAULT_TIMEZONE`: Default timezone for new users
- `TZ`: Optional process timezone fallback if `DEFAULT_TIMEZONE` is unset

## 3. Callback URI Rules

Freshwax derives callback URIs from `APP_URL`. Set `APP_URL` first, then register the matching absolute URLs with providers.

Local example:

```text
APP_URL=http://127.0.0.1:3000
```

Production example:

```text
APP_URL=https://freshwax.example.com
```

Provider callback paths:

| Provider | Register this callback URI |
| --- | --- |
| Spotify | `${APP_URL}/api/auth/spotify/callback` |
| YouTube Music / Google | `${APP_URL}/api/auth/youtube_music/callback` |
| Amazon Music / Login with Amazon | `${APP_URL}/api/auth/amazon_music/callback` |
| TIDAL | `${APP_URL}/api/auth/tidal/callback` |
| Deezer | `${APP_URL}/api/deezer/callback` |

Notes:

- Redirect URIs must match exactly, including scheme, host, path, and trailing slash behavior.
- For local Spotify development, use `127.0.0.1`, not `localhost`.
- If you expose Freshwax behind a reverse proxy, `APP_URL` must still be the public origin users actually visit.

## 4. Provider Setup

The provider credentials below are optional. Freshwax can still track releases without them.

### Spotify

Purpose in Freshwax:

- optional external login and account linking

Freshwax requests these scopes:

- `user-read-email`
- `user-read-private`

Set these env vars:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Register this redirect URI:

- `${APP_URL}/api/auth/spotify/callback`

Local example:

- `http://127.0.0.1:3000/api/auth/spotify/callback`

Production example:

- `https://freshwax.example.com/api/auth/spotify/callback`

Operator checklist:

1. Create a Spotify app in the Spotify Developer Dashboard.
2. Add the exact redirect URI above.
3. If the app is in development mode, make sure the app owner has Spotify Premium and add every connecting Spotify account to the app allowlist.
4. Copy the client ID and client secret into `.env`.
5. Restart the app after changing env vars.

Official references:

- [Spotify redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Spotify scopes reference](https://developer.spotify.com/documentation/general/guides/scopes)

### YouTube Music / Google

Purpose in Freshwax:

- Google-backed external login branded as YouTube Music in the UI

Freshwax requests this Google scope set:

- `openid`
- `email`
- `profile`

Set these env vars:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Register this redirect URI:

- `${APP_URL}/api/auth/youtube_music/callback`

Operator checklist:

1. Create a Google OAuth 2.0 Web application client in Google Cloud.
2. Add the exact authorized redirect URI above.
3. Complete any required OAuth consent-screen setup for your project.
4. Copy the client ID and client secret into `.env`.

Notes:

- Freshwax currently uses Google identity only. It does not call a YouTube Music account API from this login flow.
- Google requires exact redirect URI matches.

Official reference:

- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)

### Amazon Music / Login with Amazon

Purpose in Freshwax:

- Amazon-backed external login branded as Amazon Music in the UI

Freshwax requests this scope:

- `profile`

Set these env vars:

- `AMAZON_CLIENT_ID`
- `AMAZON_CLIENT_SECRET`

Register this redirect URI:

- `${APP_URL}/api/auth/amazon_music/callback`

Operator checklist:

1. Create or reuse a Login with Amazon security profile.
2. Add the callback URL above as an allowed return URL for the website integration.
3. Copy the client ID and client secret into `.env`.

Notes:

- Freshwax uses the server-side authorization code flow.
- For production, use HTTPS for the public site.

Official references:

- [Login with Amazon overview](https://developer.amazon.com/docs/login-with-amazon/documentation-overview.html)
- [Login with Amazon security profile](https://developer.amazon.com/docs/login-with-amazon/security-profile.html)
- [Login with Amazon profile scope](https://developer.amazon.com/docs/login-with-amazon/obtain-customer-profile.html)

### TIDAL

Purpose in Freshwax:

- optional external login and account linking
- followed-artist import from a connected TIDAL account

Freshwax requires OAuth 2.1 with PKCE and requests these scopes:

- `user.read`
- `collection.read`
- `collection.write`

Set these env vars:

- `TIDAL_CLIENT_ID`
- `TIDAL_CLIENT_SECRET`

Register this redirect URI:

- `${APP_URL}/api/auth/tidal/callback`

Operator checklist:

1. Create or reuse a TIDAL developer app.
2. Add the exact redirect URI above.
3. Enable `user.read`, `collection.read`, and `collection.write`.
4. Copy the client ID into `.env`.
5. Optionally set `TIDAL_CLIENT_SECRET` as well so your env file stays aligned with `.env.example`, even though the current token exchange path uses the client ID plus PKCE.

Notes:

- Freshwax generates the PKCE verifier/challenge itself.
- If the TIDAL app lacks one of the required scopes, login or import behavior will fail later in the flow.

Official reference:

- [TIDAL authorization and PKCE](https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization)

### Deezer

Purpose in Freshwax:

- optional account linking
- library import
- metadata enrichment and exact provider mappings

Freshwax requests these Deezer permissions:

- `basic_access`
- `manage_library`
- `offline_access`

Set these env vars:

- `DEEZER_APP_ID`
- `DEEZER_APP_SECRET`

Register this redirect URI:

- `${APP_URL}/api/deezer/callback`

Operator checklist:

1. Create or reuse a Deezer app.
2. Add the exact callback URL above.
3. Confirm the app is allowed to request `basic_access`, `manage_library`, and `offline_access`.
4. Copy the Deezer app ID and secret into `.env`.

Notes:

- Deezer integration is optional. Core release tracking still works without it.
- Freshwax handles Deezer quota responses with exponential backoff and keeps sync concurrency low by default.
- Deezer write-back beyond library/account import is intentionally limited.

### Apple Music / Sign in with Apple

Current status:

- env placeholders exist
- provider appears in preferences
- end-user external auth callback flow is not implemented

Do not spend time registering Apple callbacks unless you plan to extend the code. Today this is best treated as reserved configuration.

## 5. Last.fm Setup

Purpose in Freshwax:

- import artists by Last.fm username

Set this env var:

- `LASTFM_API_KEY`

Operator checklist:

1. Obtain a Last.fm API key.
2. Set `LASTFM_API_KEY` in `.env`.
3. Restart the app.

No callback URI is needed for Last.fm because this integration is API-key based, not OAuth-based.

## 6. Browser Push Setup

Purpose in Freshwax:

- send release-day and discovery notifications to subscribed browsers

Set these env vars:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`

Generate keys with the installed `web-push` package:

```bash
npx web-push generate-vapid-keys
```

Copy the generated keys into `.env`.

Important behavior:

- Push subscriptions are per-browser and per-user.
- Browsers generally require a secure context for Push API and service workers.
- Local development on loopback addresses typically works, but production should use HTTPS.
- If VAPID keys are missing, the push notification UI stays disabled.

Freshwax uses `APP_URL` as the VAPID subject URL, so `APP_URL` should always be set to the canonical origin.

## 7. Webhook Notification Setup

Purpose in Freshwax:

- send instance-wide release notifications to an external HTTP endpoint

Set these env vars:

- `NOTIFICATION_WEBHOOK_URL`
- `NOTIFICATION_WEBHOOK_SECRET` optional but strongly recommended

When `NOTIFICATION_WEBHOOK_SECRET` is set, Freshwax signs the raw JSON request body with HMAC-SHA256 and sends the hex digest as:

- `x-freshwax-signature`

Payload shape:

```json
{
  "notificationEventId": "string",
  "kind": "release_day | release_discovered",
  "user": {
    "id": "string",
    "email": "user@example.com",
    "timezone": "Europe/Amsterdam"
  },
  "release": {
    "id": "string",
    "title": "Album Title",
    "type": "ALBUM",
    "releaseDate": "2026-04-22T00:00:00.000Z"
  },
  "artist": {
    "id": "string",
    "name": "Artist Name"
  },
  "targetUrl": "https://freshwax.example.com/upcoming",
  "createdAt": "2026-04-22T08:00:00.000Z",
  "scheduledFor": "2026-04-22T09:00:00.000Z"
}
```

If no delivery channels are configured, notification events are skipped rather than retried forever.

## 8. Database and Schema Bootstrapping

Freshwax treats Prisma as the source of truth for the schema.

For first-time setup:

```bash
npx prisma generate
npx prisma db push
```

Optional local demo data:

```bash
npm run prisma:seed
```

If the background schema is missing, the worker will skip jobs until `prisma db push` has been run successfully.

## 9. Run Modes

### Mode A: Full Docker Compose stack

Best for:

- quickest end-to-end local setup
- smoke-testing the self-hosted deployment shape

Run:

```bash
docker compose up --build
```

What starts:

- `postgres`
- `redis`
- `db-init` running `npx prisma db push`
- `app` running `node .next/standalone/server.js`
- `worker` running `npx tsx src/worker.ts`

Open:

- `http://127.0.0.1:3000`

Notes:

- Compose maps PostgreSQL to `localhost:5432` and Redis to `localhost:6380`.
- Inside the Compose network, app and worker talk to Redis using `redis://redis:6379`.
- This is the closest match to the intended self-hosted topology.

### Mode B: Local app + local worker, Dockerized Postgres/Redis

Best for:

- active development with HMR
- code changes in the app and worker without rebuilding images

Start infrastructure:

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

Use this `.env` pairing locally:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/freshwax?schema=public
REDIS_URL=redis://localhost:6380
APP_URL=http://127.0.0.1:3000
```

Notes:

- `npm run dev:all` starts both Next.js HMR and the worker watcher.
- This is the default development mode if you are changing both UI and sync logic.

### Mode C: App-only local development

Best for:

- UI-only work
- auth and page rendering work where background jobs are not needed immediately

Run:

```bash
npm run dev
```

What you lose without the worker:

- recurring full sync scheduling
- background artist sync execution
- scheduled notification draining

The app can still render and accept mutations, but queue-backed behavior will not complete until a worker is running.

### Mode D: Worker-only local development

Best for:

- debugging sync and notification delivery

Run:

```bash
npm run dev:worker
```

or for a non-watch process:

```bash
npm run start:worker
```

Make sure PostgreSQL, Redis, and the Prisma schema are already available before starting the worker.

### Mode E: Built app + separate worker without Docker Compose

Best for:

- production-like testing on a host with existing PostgreSQL and Redis
- process managers such as systemd, supervisord, or a PaaS that runs separate commands

Build:

```bash
npm install
npx prisma generate
npm run build
```

Initialize schema:

```bash
npx prisma db push
```

Start the web app:

```bash
npm run start
```

Start the worker separately:

```bash
npm run start:worker
```

Notes:

- In the Docker image, the web app runs from Next standalone output.
- Outside Docker, `npm run start` uses `next start`, which is fine for non-container deployments.
- If you skip the worker in production, sync freshness and notification delivery degrade materially.

## 10. Recommended Bring-Up Order

For a clean first run:

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `REDIS_URL`, and `APP_URL`.
3. If you need provider logins, register each app and add matching callback URIs.
4. If you need browser push, generate and add VAPID keys.
5. If you need outbound webhooks, set the webhook URL and secret.
6. Run `npx prisma generate`.
7. Run `npx prisma db push`.
8. Start the app and worker in your preferred mode.
9. Optionally run `npm run prisma:seed`.

## 11. Verification Checklist

After setup, verify the basics:

```bash
npx prisma generate
npx prisma validate
npm run lint
npm run build
```

If you changed schema or are bootstrapping a fresh database, also run:

```bash
npx prisma db push
npm run prisma:seed
```

Manual checks:

- sign up with email/password
- open the dashboard and search page
- connect one configured provider
- follow an artist and confirm the worker picks up sync jobs
- enable push notifications if VAPID keys are configured
- verify webhook delivery if a webhook URL is configured

## 12. Common Failure Modes

### OAuth redirect mismatch

Usually caused by:

- `APP_URL` not matching the actual public origin
- registering `localhost` with Spotify instead of `127.0.0.1`
- missing trailing-slash consistency in provider console settings

### Spotify consent succeeds, but callback returns provider-error

Usually caused by Spotify development-mode restrictions:

- the app owner does not have an active Spotify Premium subscription
- the connecting Spotify account is not added to the app allowlist

Spotify may still show the consent screen in this state, but the profile API can return `403`.

### App works, but sync never happens

Usually caused by:

- no worker process running
- Redis unavailable
- Prisma schema not applied yet

### Push notification UI is disabled

Usually caused by:

- missing `WEB_PUSH_PUBLIC_KEY` or `WEB_PUSH_PRIVATE_KEY`
- browser lacks Push API or service worker support
- insecure production origin

### Provider button appears, but login is unavailable

Usually caused by:

- env vars are missing for that provider
- provider is only partially implemented in Freshwax
- the app registration is missing scopes or callback URIs

## 13. Source References

These external docs are useful when provider console wording changes:

- [Spotify redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Spotify scopes](https://developer.spotify.com/documentation/general/guides/scopes)
- [Google OAuth for web server apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Login with Amazon docs overview](https://developer.amazon.com/docs/login-with-amazon/documentation-overview.html)
- [Login with Amazon security profile](https://developer.amazon.com/docs/login-with-amazon/security-profile.html)
- [TIDAL authorization and PKCE](https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization)
