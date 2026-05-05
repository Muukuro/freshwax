# Architecture Notes

## Stack

- Next.js App Router with TypeScript for UI, server rendering, route handlers, and server actions.
- PostgreSQL with Prisma for canonical artist, release, user, discovery, and session data.
- Redis with BullMQ for restart-safe background sync scheduling.
- MusicBrainz as the canonical identity layer and credential-free release discovery backbone, with provider enrichment layered on top.
- MusicBrainz requests are centralized behind an in-process 1 request/second gate with retry backoff and a contactable User-Agent using the instance `APP_URL`.
- Wikidata enriches canonical artist records with structured profile signals such as classical-composer classification.
- Last.fm public API as an optional per-user import source based on a saved username and minimum listen threshold.
- Optional external login/account-link adapters per provider.
- Provider-generated outbound links filtered by per-user platform preferences.
- Browser push plus optional operator webhook delivery for notification events.
- PWA install metadata, generated app icons, and offline navigation fallback served by the Next.js app and the shared public service worker.

## Main decisions

- Local password auth remains available, but external identities can now create or link to Freshwax accounts while Freshwax still owns the final session cookie.
- External identity conflicts during a signed-in connection flow create a short-lived `PendingAccountMerge` confirmation instead of silently merging accounts. Confirming from Settings moves user-owned data into the signed-in account while preserving that account's email/password/session and calendar token.
- Core artist search, following, sync, dashboard feeds, and calendar output must work without any configured platform credentials.
- External import sources are optional and additive: a Last.fm username and/or streaming-platform account can be linked per local user, but they do not replace local sessions.
- Canonical artist and release records are separated from provider mappings so the app can tolerate imperfect cross-provider linkage.
- Canonical artist records require the MusicBrainz artist ID as a dedicated field instead of overloading internal primary keys, which keeps provider imports anchored to a stable canonical identity.
- Provider mappings can be corrected manually from artist and release detail pages. These corrections are global catalog state for the self-hosted instance, but they only repair exact external links; MusicBrainz remains the canonical identity layer.
- Automatic MusicBrainz, Wikidata, and Deezer enrichment may add missing provider mappings, but it must not overwrite manually corrected mappings for the same catalog item and provider.
- The "hide classical composer appearances" setting targets composer appearances, not all classical releases: Wikidata classifies whether the followed artist is a classical composer, while MusicBrainz recording-to-work relationships reached through a representative release should determine whether that artist appears only as composer or work creator on a specific release.
- Composer-appearance classification is stored on the release/artist association during sync so feeds, calendar output, and notifications share one persisted interpretation instead of recalculating provider-specific raw metadata at read time.
- A release remains visible when the followed classical composer is credited as a performer, conductor, ensemble member, or primary release artist anywhere on the release; composer-only classification applies only when no non-composer role is present.
- Per-user platform behavior is modeled in `UserPlatformPreference` so import eligibility and visible links can vary by user without mutating canonical artist/release records.
- Timezone remains per-user state, seeded from an instance default resolved as `DEFAULT_TIMEZONE`, then `TZ`, then `UTC`, so feeds and timestamps respect each account without requiring an admin settings surface.
- Discovery is modeled per user via `DiscoveryEvent`, but the main feed is framed around recent releases; discovery events now act as attribution for late finds instead of deciding whether a release belongs in the recent feed.
- The primary recent-release surface is `/recent`; it includes release-day items and supports URL-only temporary view filters that can broaden or narrow release types and ignored visibility without changing persistent settings.
- Upcoming releases are a planning surface for future-dated releases only, starting after the user's local release day.
- Release-type settings are persistent visibility defaults for feeds, calendar output, and notifications; they do not limit canonical release sync/import scope.
- Ignoring a release is per-user and does not mutate the shared canonical release record.
- Calendar feeds are tokenized and stable, with deterministic UIDs based on release id plus token, and include both recent and upcoming date windows while respecting persistent settings.
- Notification events are persisted per user/release/kind, scheduled in UTC using the user timezone, and fanned out into per-channel delivery records.
- Full-catalog sync is app-driven: the worker maintains recurring scheduling, and authenticated app visits opportunistically enqueue a global sync when the watchlist is stale so the dashboard does not rely on a manual button.
- Recurring sync includes startup jitter so self-hosted instances do not all wake up on the same exact interval boundary.
- First-run onboarding is explicit: new users choose favorite platforms, default release visibility, and link behavior before they land in the main app shell.
- The browser service worker remains at `/push-sw.js` so existing push subscription setup and app-wide PWA caching use one stable registration scope. It excludes API routes and private calendar feed URLs from runtime caching.

## Known limitations

- Deezer metadata quality varies; it is treated as optional enrichment sourced from canonical mappings rather than a prerequisite for identity or release sync.
- Manual provider mappings are intentionally narrow: they fix exact artist or release links, but they do not edit canonical names, dates, release types, or artist/release ownership.
- Classical composer hiding is intentionally conservative and depends on MusicBrainz having enough release-specific relationship data to distinguish composer/work-creator appearances from performer, ensemble, or conductor releases.
- If MusicBrainz lacks enough recording/work relationship data to prove a composer-only appearance, Freshwax keeps the release visible.
- Import sources are best-effort, but they now only create followed artists after resolving a canonical MusicBrainz identity.
- MusicBrainz request pacing is per Node.js process. Operators running multiple app or worker replicas behind one source IP should keep aggregate concurrency low enough to stay within MusicBrainz's source-IP guidance.
- Only a subset of external login providers are fully implemented in this pass; unsupported providers still render as gated capabilities in onboarding and settings.
- TIDAL external login and account linking are implemented with OAuth 2.1 + PKCE and currently assume the TIDAL app has `user.read`, `collection.read`, and `collection.write` enabled.
- Apple Music, Amazon Music, and YouTube Music still provide incomplete account-link/import coverage compared with the preference model exposed in the UI.
- Webhook delivery is generic JSON rather than a Discord-native or ntfy-native formatter.
- Offline PWA behavior is limited to previously cached pages and static assets; live release data, mutations, sync status, and private calendar feeds still require the network.
