# Architecture Notes

## Stack

- Next.js App Router with TypeScript for UI, server rendering, route handlers, and server actions.
- PostgreSQL with Prisma for canonical artist, release, user, discovery, and session data.
- Redis with BullMQ for restart-safe background sync scheduling.
- MusicBrainz as the canonical identity layer and credential-free release discovery backbone, with provider enrichment layered on top.
- Last.fm public API as an optional per-user import source based on a saved username and minimum listen threshold.
- Optional external login/account-link adapters per provider.
- Provider-generated outbound links filtered by per-user platform preferences.
- Browser push plus optional operator webhook delivery for notification events.

## Main decisions

- Local password auth remains available, but external identities can now create or link to Freshwax accounts while Freshwax still owns the final session cookie.
- Core artist search, following, sync, dashboard feeds, and calendar output must work without any configured platform credentials.
- External import sources are optional and additive: a Last.fm username and/or streaming-platform account can be linked per local user, but they do not replace local sessions.
- Canonical artist and release records are separated from provider mappings so the app can tolerate imperfect cross-provider linkage.
- Canonical artist records require the MusicBrainz artist ID as a dedicated field instead of overloading internal primary keys, which keeps provider imports anchored to a stable canonical identity.
- Per-user platform behavior is modeled in `UserPlatformPreference` so import eligibility and visible links can vary by user without mutating canonical artist/release records.
- Timezone remains per-user state, seeded from an instance default resolved as `DEFAULT_TIMEZONE`, then `TZ`, then `UTC`, so feeds and timestamps respect each account without requiring an admin settings surface.
- Discovery is modeled per user via `DiscoveryEvent`, but the main feed is framed around recent releases; discovery events now act as attribution for late finds instead of deciding whether a release belongs in the recent feed.
- Ignoring a release is per-user and does not mutate the shared canonical release record.
- Calendar feeds are tokenized and stable, with deterministic UIDs based on release id plus token.
- Notification events are persisted per user/release/kind, scheduled in UTC using the user timezone, and fanned out into per-channel delivery records.
- Full-catalog sync is app-driven: the worker maintains recurring scheduling, and authenticated app visits opportunistically enqueue a global sync when the watchlist is stale so the dashboard does not rely on a manual button.
- First-run onboarding is explicit: new users choose favorite platforms, import defaults, and link visibility before they land in the main app shell.

## Known limitations

- Deezer metadata quality varies; it is treated as optional enrichment sourced from canonical mappings rather than a prerequisite for identity or release sync.
- Import sources are best-effort, but they now only create followed artists after resolving a canonical MusicBrainz identity.
- Only a subset of external login providers are fully implemented in this pass; unsupported providers still render as gated capabilities in onboarding and settings.
- TIDAL external login and account linking are implemented with OAuth 2.1 + PKCE and currently assume the TIDAL app has `user.read`, `collection.read`, and `collection.write` enabled.
- Apple Music, Amazon Music, and YouTube Music still provide incomplete account-link/import coverage compared with the preference model exposed in the UI.
- Webhook delivery is generic JSON rather than a Discord-native or ntfy-native formatter.
