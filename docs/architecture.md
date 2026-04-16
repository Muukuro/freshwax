# Architecture Notes

## Stack

- Next.js App Router with TypeScript for UI, server rendering, route handlers, and server actions.
- PostgreSQL with Prisma for canonical artist, release, user, discovery, and session data.
- Redis with BullMQ for restart-safe background sync scheduling.
- Deezer public API as the live search and release metadata source.
- Last.fm public API as an optional per-user import source based on a saved username and minimum listen threshold.
- Deezer OAuth as an optional per-user account link for importing followed artists.
- TIDAL search URLs as the optional secondary listening path when exact catalog mapping is unavailable.

## Main decisions

- Local password auth is used instead of a third-party identity provider to keep self-hosting straightforward.
- External import sources are optional and additive: a Last.fm username with a per-user minimum listen threshold and/or Deezer account can be linked per local user, but they do not replace local auth or local sessions.
- Canonical artist and release records are separated from provider mappings so the app can tolerate imperfect cross-provider linkage.
- Discovery is modeled per user via `DiscoveryEvent`, but it is intentionally limited to recent missed releases rather than full historical catalog backfill.
- Ignoring a release is per-user and does not mutate the shared canonical release record.
- Calendar feeds are tokenized and stable, with deterministic UIDs based on release id plus token.

## Known limitations

- Deezer metadata quality varies; release type classification uses heuristics for remasters, live albums, compilations, and EPs.
- Last.fm import is name-based and only auto-follows artists that resolve to an exact normalized Deezer search match.
- Deezer account linking currently supports importing followed artists into the local watchlist, but not Deezer-side write-back mutations for albums or artists.
- TIDAL is implemented as a search-link fallback instead of a full authenticated catalog sync.
- The app currently does not send notifications; it stores `NotificationEvent` rows so email or webhook delivery can be added without remodelling the system.
