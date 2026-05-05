# Freshwax

Freshwax tracks releases from artists a user follows, with the product centered on recent releases while still supporting future release planning.

## Language

**Recent Release**:
A release from a followed artist on or after release day within the user's recent-release window, presented as the primary recency-oriented feed.
_Avoid_: Discovery, discovered release, inbox

**Release**:
A music publication from an artist, including albums, singles, EPs, compilations, live releases, reissues, and remasters when the user's filters allow them.
_Avoid_: Album

**Upcoming Release**:
A not-yet-released release from a followed artist within the user's calendar horizon.
_Avoid_: Main feed, primary feed

**Discovery Attribution**:
Metadata that explains when Freshwax surfaced a release after its release date.
_Avoid_: Feed category, alert category

**Release-Type Preference**:
A persistent user setting that controls which release types appear in feeds, calendar output, and notifications by default.
_Avoid_: Import setting, sync scope

**View Filter**:
A temporary on-page filter for changing which **Recent Releases** are visible without changing persistent preferences.
_Avoid_: Account setting, import filter

**Ignored Release**:
A release a user has chosen to hide from their default feeds, calendar output, and notifications.
_Avoid_: Deleted release, archived release

**Calendar Feed**:
A private date-based feed containing releases from the user's recent-release window and upcoming-release horizon.
_Avoid_: Upcoming-only feed

**Primary Listen Action**:
The main outbound release link chosen from the user's favorite visible platform preferences.
_Avoid_: Generic platform link, equal link list

## Relationships

- A **Release** belongs in feeds only when its release type passes the user's filters.
- A **Release-Type Preference** defines the default scope for **Recent Releases**.
- A **View Filter** can narrow or broaden visible **Recent Releases**, including **Ignored Releases**, without changing persistent user settings.
- A **Recent Release** may have **Discovery Attribution** when Freshwax found it after release day.
- An **Upcoming Release** becomes a **Recent Release** on release day.
- A **Calendar Feed** includes both **Recent Releases** and **Upcoming Releases** within their date windows.
- A **Recent Release** card should expose one **Primary Listen Action** before secondary platform links.

## Example dialogue

> **Dev:** "Should the dashboard show **Upcoming Releases** first?"
> **Domain expert:** "No — the dashboard should lead with **Recent Releases** because they are the freshest releases from followed artists. **Upcoming Releases** are useful, but they belong in a future-looking surface."

## Flagged ambiguities

- "discovery" previously named the recent-release feed, but **Discovery Attribution** is only metadata for late finds; the feed concept is **Recent Release**.
- "Discoveries" is retired as a user-facing route or navigation label; use **Recent Releases** for the primary recency-oriented surface.
- "album" was used casually for the listening target, but the domain concept is **Release** because singles and EPs can be included by user settings.
- Release-type settings were suspected to control import scope, but they are **Release-Type Preferences**: persistent visibility defaults, not sync/import limits.
- **View Filters** expose user-facing release formats as independent toggles; albums and EPs must not be grouped into one control, and provider-metadata fallbacks like unknown type should not be presented as a normal filter.
- Recent-first product decisions belong in both `CONTEXT.md` for language and `docs/architecture.md` for product/architecture alignment.
