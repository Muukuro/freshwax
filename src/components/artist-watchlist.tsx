"use client";

import { useDeferredValue, useState } from "react";
import { Headphones, Search, UserMinus } from "lucide-react";

import { unfollowArtistAction } from "@/app/actions/follows";
import { EmptyState } from "@/components/empty-state";
import { PlatformLink } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { type PlatformLinkEntry } from "@/lib/data";
import { normalizeName, releaseDateLabel } from "@/lib/utils";

type ArtistWatchlistEntry = {
  artistId: string;
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

function initialsForArtist(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ArtistWatchlist({ followed }: { followed: ArtistWatchlistEntry[] }) {
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);
  const normalizedFilter = normalizeName(deferredFilter);
  const visibleFollowed = normalizedFilter
    ? followed.filter((entry) => normalizeName(entry.canonicalName).includes(normalizedFilter))
    : followed;

  return (
    <>
      <div className="watchlist-filter-shell">
        <label className="field flex-1">
          <span className="watchlist-filter-label">Filter followed artists</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="watchlist-filter-input"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by artist name"
              type="search"
              value={filter}
            />
          </div>
        </label>
        <p className="watchlist-filter-meta">
          {visibleFollowed.length === followed.length
            ? `${followed.length.toLocaleString()} artists followed`
            : `${visibleFollowed.length.toLocaleString()} of ${followed.length.toLocaleString()} artists shown`}
        </p>
      </div>

      {visibleFollowed.length === 0 ? (
        <EmptyState
          title="No artists match this filter"
          body="Try a shorter name or clear the watchlist filter."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {visibleFollowed.map((follow) => (
            <article key={follow.artistId} className="panel flex min-h-0 flex-col gap-4 px-4 py-4">
              <div className="flex items-start gap-3">
                <div
                  className="release-art flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-cover bg-center text-sm font-semibold text-[var(--text)]"
                  style={
                    follow.imageUrl
                      ? { backgroundImage: `url(${follow.imageUrl})` }
                      : {
                          background:
                            "linear-gradient(135deg, rgba(45,109,246,0.22), rgba(15,28,43,0.08))",
                        }
                  }
                >
                  {follow.imageUrl ? null : initialsForArtist(follow.canonicalName)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-[var(--text)]">
                    {follow.canonicalName}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    {follow.deezerFans ? (
                      <span className="status-pill px-2 py-1">
                        <Headphones className="h-3.5 w-3.5" />
                        {follow.deezerFans.toLocaleString()}
                      </span>
                    ) : null}
                    <span className="status-pill px-2 py-1">
                      {follow.knownReleaseCount.toLocaleString()} known releases
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel-muted space-y-2 p-3 text-sm">
                <p className="text-[var(--muted)]">
                  Last synced{" "}
                  <span className="font-medium text-[var(--text)]">
                    {follow.lastSyncedAt ? new Date(follow.lastSyncedAt).toLocaleString() : "not yet"}
                  </span>
                </p>
                <p className="text-[var(--muted)]">
                  Latest known release{" "}
                  <span className="font-medium text-[var(--text)]">
                    {follow.latestKnownRelease
                      ? `${follow.latestKnownRelease.title} • ${releaseDateLabel(new Date(follow.latestKnownRelease.releaseDate))}`
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

              <form action={unfollowArtistAction} className="mt-auto">
                <input name="artistId" type="hidden" value={follow.artistId} />
                <SubmitButton className="ghost-button w-full justify-center" pendingLabel="Removing...">
                  <UserMinus className="h-4 w-4" />
                  Unfollow
                </SubmitButton>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
