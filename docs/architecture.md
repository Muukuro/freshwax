# Architecture Notes

## Stack

- Next.js App Router with TypeScript for UI, server rendering, route handlers, and server actions.
- PostgreSQL with Prisma for canonical artist, release, user, discovery, and session data.
- Redis with BullMQ for restart-safe background sync scheduling.
- MusicBrainz as the canonical identity layer and credential-free release discovery backbone, with provider enrichment layered on top.
- MusicBrainz requests are centralized behind an in-process 1 request/second gate with retry backoff and a contactable User-Agent using the instance `APP_URL`.
- Cover Art Archive provides best-effort release-group artwork keyed by MusicBrainz identity when Deezer artwork is unavailable.
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
- Canonical releases persist a nullable, unique MusicBrainz release-group ID. Sync matches that identity before provider mappings and exact title/date shape, and it may merge records automatically only when strong MusicBrainz/provider evidence proves they represent the same release.
- Authenticated users may manually merge same-title releases only when both share an artist they follow. The selected survivor keeps its canonical metadata while artist associations, provider mappings, discoveries, ignores, notifications, and delivery history are transactionally preserved.
- Canonical artist records require the MusicBrainz artist ID as a dedicated field instead of overloading internal primary keys, which keeps provider imports anchored to a stable canonical identity.
- Provider mappings can be corrected manually from artist and release detail pages. These corrections are global catalog state for the self-hosted instance, but they only repair exact external links; MusicBrainz remains the canonical identity layer.
- Automatic MusicBrainz, Wikidata, and Deezer enrichment may add missing provider mappings, but it must not overwrite manually corrected mappings for the same catalog item and provider.
- Deezer artwork takes precedence when available; approved Cover Art Archive front images fill missing canonical release artwork, and transient enrichment failures never clear stored artwork.
- The "hide classical composer appearances" setting targets composer appearances, not all classical releases: Wikidata classifies whether the followed artist is a classical composer, while MusicBrainz recording-to-work composer relationships reached through a representative release should determine whether that artist appears only as composer on a specific release.
- Composer-appearance classification is stored on the release/artist association during sync so feeds, calendar output, and notifications share one persisted interpretation instead of recalculating provider-specific raw metadata at read time.
- Release/artist roles use a small application-controlled vocabulary, currently distinguishing primary associations from composer appearances, while staying compatible with the current `prisma db push` bootstrap flow.
- A release remains visible when the followed classical composer is credited as a performer, conductor, ensemble member, or primary release artist anywhere on the release; composer-only classification applies only when no non-composer role is present.
- User-scoped filtering hides a release only when every followed artist associated with that release is classified as a composer appearance.
- Hidden composer appearances remain directly reachable as followed-artist release details and report that current settings filter them out, matching other visibility preferences.
- Existing release/artist rows are reclassified best-effort during normal artist sync rather than by a schema migration that calls external providers.
- Recording/work role classification is attempted only for artists classified as classical composers, keeping MusicBrainz request volume tied to the setting's actual scope.
- Release-group-shaped feed items use one deterministic representative MusicBrainz release for recording/work classification rather than scanning every edition in the release group.
- Representative release selection prefers an official release with media and recordings matching the release group's first-release date, then the earliest official release with recordings, then the earliest release with recordings; if none have usable recordings, the association stays visible.
- Per-user platform behavior is modeled in `UserPlatformPreference` so import eligibility and visible links can vary by user without mutating canonical artist/release records.
- Timezone remains per-user state, seeded from an instance default resolved as `DEFAULT_TIMEZONE`, then `TZ`, then `UTC`, so feeds and timestamps respect each account without requiring an admin settings surface.
- Discovery is modeled per user via `DiscoveryEvent`, but the main feed is framed around recent releases; discovery events now act as attribution for late finds instead of deciding whether a release belongs in the recent feed.
- Discovery events are recorded independently of composer-appearance visibility so users can reveal those releases later by changing the setting without needing a resync.
- The primary recent-release surface is `/recent`; it includes release-day items and supports URL-only temporary view filters that can broaden or narrow release types and ignored visibility without changing persistent settings.
- Upcoming releases are a planning surface for future-dated releases only, starting after the user's local release day.
- Release-type settings are persistent visibility defaults for feeds, calendar output, and notifications; they do not limit canonical release sync/import scope.
- Ignoring a release is per-user and does not mutate the shared canonical release record.
- Calendar feeds are tokenized and stable, with deterministic UIDs based on release id plus token, and include both recent and upcoming date windows while respecting persistent settings.
- Notification events are persisted per user/release/kind, scheduled in UTC using the user timezone, and fanned out into per-channel delivery records.
- Full-catalog sync is app-driven: the worker maintains recurring scheduling, and authenticated app visits opportunistically enqueue a global sync when the watchlist is stale so the dashboard does not rely on a manual button.
- The production Docker image defaults to one Freshwax service: startup applies the Prisma schema, then runs the web server and BullMQ worker under the same container lifecycle. This keeps self-hosted Compose installs simple while still allowing non-Docker process managers to run the app and worker separately.
- Recurring sync includes startup jitter so self-hosted instances do not all wake up on the same exact interval boundary.
- First-run onboarding is explicit: new users choose favorite platforms, default release visibility, and link behavior before they land in the main app shell.
- The browser service worker remains at `/push-sw.js` so existing push subscription setup and app-wide PWA caching use one stable registration scope. It excludes API routes and private calendar feed URLs from runtime caching.

## Known limitations

- Deezer metadata quality varies; it is treated as optional enrichment sourced from canonical mappings rather than a prerequisite for identity or release sync.
- Cover Art Archive coverage depends on community-curated approved front images; missing, malformed, or unavailable artwork leaves the existing visual fallback in place.
- Manual provider mappings are intentionally narrow: they fix exact artist or release links, but they do not edit canonical names, dates, release types, or artist/release ownership.
- Manual duplicate resolution is intentionally narrow: it only offers same-title releases sharing a followed artist, requires explicit confirmation, and does not provide general catalog editing.
- Classical composer hiding is intentionally conservative and depends on MusicBrainz having enough release-specific relationship data to distinguish composer appearances from performer, ensemble, or conductor releases.
- If MusicBrainz lacks enough recording/work relationship data to prove a composer-only appearance, Freshwax keeps the release visible.
- Deezer genre and track attribution hints are not used as a fallback for composer-appearance hiding; Deezer remains artwork/link enrichment only for this flow.
- The user-facing setting label remains "Hide classical composer appearances"; the implementation defines that as proven composer-only appearances, not all classical releases.
- Transient failures while fetching role-classification evidence do not fail artist sync; affected associations remain visible and sync continues.
- Composer-appearance classification is refreshed during each normal artist sync for in-window releases so improved MusicBrainz relationship data can correct existing release/artist roles over time.
- Import sources are best-effort, but they now only create followed artists after resolving a canonical MusicBrainz identity.
- MusicBrainz request pacing is per Node.js process. Operators running multiple app or worker replicas behind one source IP should keep aggregate concurrency low enough to stay within MusicBrainz's source-IP guidance.
- Only a subset of external login providers are fully implemented in this pass; unsupported providers still render as gated capabilities in onboarding and settings.
- TIDAL external login and account linking are implemented with OAuth 2.1 + PKCE and currently assume the TIDAL app has `user.read`, `collection.read`, and `collection.write` enabled.
- Apple Music, Amazon Music, and YouTube Music still provide incomplete account-link/import coverage compared with the preference model exposed in the UI.
- Webhook delivery is generic JSON rather than a Discord-native or ntfy-native formatter.
- Offline PWA behavior is limited to previously cached pages and static assets; live release data, mutations, sync status, and private calendar feeds still require the network.
