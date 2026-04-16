# Architecture Notes

## Stack

- Next.js App Router with TypeScript for UI, server rendering, route handlers, and server actions.
- PostgreSQL with Prisma for canonical artist, release, user, discovery, and session data.
- Redis with BullMQ for restart-safe background sync scheduling.
- MusicBrainz as the default canonical artist search layer, with provider enrichment layered on top.
- Last.fm public API as an optional per-user import source based on a saved username and minimum listen threshold.
- Optional external login/account-link adapters per provider.
- Provider-generated outbound links filtered by per-user platform preferences.

## Main decisions

- Local password auth remains available, but external identities can now create or link to Freshwax accounts while Freshwax still owns the final session cookie.
- External import sources are optional and additive: a Last.fm username and/or streaming-platform account can be linked per local user, but they do not replace local sessions.
- Canonical artist and release records are separated from provider mappings so the app can tolerate imperfect cross-provider linkage.
- Per-user platform behavior is modeled in `UserPlatformPreference` so import eligibility and visible links can vary by user without mutating canonical artist/release records.
- Discovery is modeled per user via `DiscoveryEvent`, but it is intentionally limited to recent missed releases rather than full historical catalog backfill.
- Ignoring a release is per-user and does not mutate the shared canonical release record.
- Calendar feeds are tokenized and stable, with deterministic UIDs based on release id plus token.
- Full-catalog sync is app-driven: the worker maintains recurring scheduling, and authenticated app visits opportunistically enqueue a global sync when the watchlist is stale so the dashboard does not rely on a manual button.
- First-run onboarding is explicit: new users choose favorite platforms, import defaults, and link visibility before they land in the main app shell.

## Known limitations

- Deezer metadata quality varies; release type classification uses heuristics for remasters, live albums, compilations, and EPs.
- Last.fm import is still best-effort and currently enriches canonical artists with Deezer mappings when possible.
- Only a subset of external login providers are fully implemented in this pass; unsupported providers still render as gated capabilities in onboarding and settings.
- TIDAL external login and account linking are implemented with OAuth 2.1 + PKCE and currently assume the TIDAL app has `user.read`, `collection.read`, and `collection.write` enabled.
- Apple Music, Amazon Music, and YouTube Music still provide incomplete account-link/import coverage compared with the preference model exposed in the UI.
- The app currently does not send notifications; it stores `NotificationEvent` rows so email or webhook delivery can be added without remodelling the system.
