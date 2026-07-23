import { Headphones, RefreshCw, UserMinus } from "lucide-react";
import Link from "next/link";

import { syncFollowedArtistNowAction, unfollowArtistAction } from "@/app/actions/follows";
import { Artwork } from "@/components/artwork";
import { ArtistWatchlistFilter } from "@/components/artist-watchlist-filter";
import { EmptyState } from "@/components/empty-state";
import { PlatformLink } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { initialsForName } from "@/lib/artwork";
import { buildArtistsHref, getPaginationItems } from "@/lib/artist-watchlist-params";
import { type PlatformLinkEntry } from "@/lib/data";
import { artistPath } from "@/lib/deeplinks";
import { formatInteger, formatReleaseDate, formatTimestampInTimeZone } from "@/lib/timezone";

type ArtistWatchlistEntry = {
  artistId: string;
  musicbrainzArtistId: string;
  canonicalName: string;
  imageUrl: string | null;
  deezerFans: number | null;
  lastSyncedAt: string | null;
  knownReleaseCount: number;
  platformLinks: PlatformLinkEntry[];
  latestKnownRelease: {
    title: string;
    releaseDate: string;
  } | null;
};

export function ArtistWatchlist({
  catalogQuery,
  followed,
  matchingCount,
  page,
  timeZone,
  totalCount,
  totalPages,
  watchlistQuery,
}: {
  catalogQuery: string;
  followed: ArtistWatchlistEntry[];
  matchingCount: number;
  page: number;
  timeZone: string;
  totalCount: number;
  totalPages: number;
  watchlistQuery: string;
}) {
  const paginationItems = getPaginationItems(page, totalPages);

  return (
    <>
      <ArtistWatchlistFilter
        catalogQuery={catalogQuery}
        matchingCount={matchingCount}
        totalCount={totalCount}
        watchlistQuery={watchlistQuery}
      />

      {followed.length === 0 ? (
        <EmptyState
          title="No artists match this filter"
          body="Try a shorter name or clear the watchlist filter."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {followed.map((follow) => (
            <article key={follow.artistId} className="panel flex min-h-0 flex-col gap-4 p-[1.1rem]">
              <div className="flex items-start gap-3">
                <Artwork
                  alt={`${follow.canonicalName} artist image`}
                  className="h-14 w-14 shrink-0 rounded-[1rem] text-sm font-semibold text-[var(--text)]"
                  fallback={initialsForName(follow.canonicalName)}
                  sizes="56px"
                  src={follow.imageUrl}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
                    <Link href={artistPath(follow.artistId)}>{follow.canonicalName}</Link>
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    {follow.deezerFans ? (
                      <span className="status-pill px-2 py-1">
                        <Headphones className="h-3.5 w-3.5" />
                        {formatInteger(follow.deezerFans)}
                      </span>
                    ) : null}
                    <span className="status-pill px-2 py-1">
                      {formatInteger(follow.knownReleaseCount)} known releases
                    </span>
                    <span
                      className="status-pill px-2 py-1"
                      title={follow.musicbrainzArtistId}
                    >
                      MBID {follow.musicbrainzArtistId.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel-muted space-y-2 p-3 text-sm">
                <p className="text-[var(--muted)]">
                  Last synced{" "}
                  <span className="font-medium text-[var(--text)]">
                    {follow.lastSyncedAt
                      ? formatTimestampInTimeZone(follow.lastSyncedAt, timeZone)
                      : "not yet"}
                  </span>
                </p>
                <p className="text-[var(--muted)]">
                  Latest known release{" "}
                  <span className="font-medium text-[var(--text)]">
                    {follow.latestKnownRelease
                      ? `${follow.latestKnownRelease.title} • ${formatReleaseDate(new Date(follow.latestKnownRelease.releaseDate))}`
                      : "not collected yet"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                {follow.platformLinks.map((link) => (
                  <PlatformLink
                    key={`${follow.artistId}-${link.provider}`}
                    className="hover:text-[var(--text)]"
                    compact
                    href={link.href}
                    label={link.label}
                  />
                ))}
              </div>

              <div className="mt-auto grid gap-2 sm:grid-cols-2">
                <form action={syncFollowedArtistNowAction}>
                  <input name="artistId" type="hidden" value={follow.artistId} />
                  <SubmitButton className="ghost-button w-full justify-center" pendingLabel="Syncing...">
                    <RefreshCw className="h-4 w-4" />
                    Sync now
                  </SubmitButton>
                </form>

                <form action={unfollowArtistAction}>
                  <input name="artistId" type="hidden" value={follow.artistId} />
                  <SubmitButton className="ghost-button w-full justify-center" pendingLabel="Removing...">
                    <UserMinus className="h-4 w-4" />
                    Unfollow
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Followed artists pages" className="flex flex-wrap items-center justify-center gap-2">
          <Link
            aria-disabled={page === 1}
            className={`ghost-button ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
            href={buildArtistsHref({
              catalogQuery,
              watchlistQuery,
              watchlistPage: Math.max(1, page - 1),
            })}
          >
            Previous
          </Link>
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span className="px-1 text-[var(--muted)]" key={`ellipsis-${index}`}>
                …
              </span>
            ) : (
              <Link
                aria-current={item === page ? "page" : undefined}
                className={`ghost-button min-w-10 justify-center ${item === page ? "border-[var(--accent)] text-[var(--text)]" : ""}`}
                href={buildArtistsHref({
                  catalogQuery,
                  watchlistQuery,
                  watchlistPage: item,
                })}
                key={item}
              >
                {item}
              </Link>
            ),
          )}
          <Link
            aria-disabled={page === totalPages}
            className={`ghost-button ${page === totalPages ? "pointer-events-none opacity-50" : ""}`}
            href={buildArtistsHref({
              catalogQuery,
              watchlistQuery,
              watchlistPage: Math.min(totalPages, page + 1),
            })}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </>
  );
}
