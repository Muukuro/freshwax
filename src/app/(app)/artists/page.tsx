import Link from "next/link";
import { Headphones, Search } from "lucide-react";

import {
  followArtistAction,
  importDeezerFollowsAction,
  importLastfmArtistsAction,
} from "@/app/actions/follows";
import { ArtistWatchlist } from "@/components/artist-watchlist";
import { EmptyState } from "@/components/empty-state";
import { ImportForm } from "@/components/import-form";
import { PlatformLink } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { searchCatalogArtists } from "@/lib/catalog";
import { getFollowedArtists } from "@/lib/data";
import { isLastfmConfigured } from "@/lib/providers/lastfm";
import { formatTimestampInTimeZone } from "@/lib/timezone";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { normalizeName } from "@/lib/utils";

function initialsForArtist(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const followed = await getFollowedArtists(user.id);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await searchCatalogArtists(query) : [];
  const lastfmConfigured = isLastfmConfigured();
  const followedNames = new Set(followed.map((entry) => normalizeName(entry.canonicalName)));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="section-heading">
          <div className="space-y-2">
            <p className="eyebrow">Artist search</p>
            <h2 className="text-3xl font-semibold text-[var(--text)]">Find artists to follow</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Search the catalog, then use Settings for provider connections and import preferences.
            </p>
          </div>
        </div>

        <form className="panel flex flex-col gap-4 md:flex-row">
          <label className="field flex-1">
            <span>Search query</span>
            <input defaultValue={query} name="q" placeholder="Try: Taylor Swift" type="search" />
          </label>
          <button className="primary-button md:self-end" type="submit">
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>

        <div className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
            {user.lastfmConnection ? (
              <p>
                Last.fm ready as{" "}
                <span className="font-medium text-[var(--text)]">
                  {user.lastfmConnection.lastfmUserName}
                </span>
                . Last imported{" "}
                {user.lastfmConnection.lastImportedAt
                  ? formatTimestampInTimeZone(user.lastfmConnection.lastImportedAt, timeZone)
                  : "never"}
                .
              </p>
            ) : lastfmConfigured ? (
              <p>Import sources and provider connections live in Settings.</p>
            ) : (
              <p>Last.fm import is disabled until `LASTFM_API_KEY` is configured.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {user.lastfmConnection ? (
              <ImportForm
                action={importLastfmArtistsAction}
                label="Import from Last.fm"
                className="ghost-button"
              />
            ) : null}
            {user.deezerConnection ? (
              <ImportForm
                action={importDeezerFollowsAction}
                label="Import from Deezer"
                className="ghost-button"
              />
            ) : null}
            <Link className="ghost-button" href="/settings">
              Manage in Settings
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {query && results.length === 0 ? (
            <EmptyState
              title="No catalog matches"
              body="Try a different spelling or a more specific artist name."
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {results.map((artist) => (
                <article
                  key={artist.catalogArtistId}
                  className="panel flex items-center gap-4 px-4 py-4"
                >
                  <div
                    className="release-art flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-cover bg-center text-sm font-semibold text-[var(--text)]"
                    style={
                      artist.imageUrl
                        ? { backgroundImage: `url(${artist.imageUrl})` }
                        : {
                            background:
                              "linear-gradient(135deg, rgba(45,109,246,0.22), rgba(15,28,43,0.08))",
                          }
                    }
                  >
                    {artist.imageUrl ? null : initialsForArtist(artist.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-[var(--text)]">
                      {artist.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      {artist.popularity ? (
                        <span className="status-pill px-2 py-1">
                          <Headphones className="h-3.5 w-3.5" />
                          {artist.popularity.toLocaleString()} Deezer listeners
                        </span>
                      ) : null}
                      {artist.description ? <span>{artist.description}</span> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {artist.platformLinks.slice(0, 4).map((link) => (
                        <PlatformLink
                          key={`${artist.catalogArtistId}-${link.provider}`}
                          className="text-[var(--muted)] hover:text-[var(--text)]"
                          compact
                          href={link.href}
                          label={link.label}
                        />
                      ))}
                    </div>
                  </div>
                  {followedNames.has(normalizeName(artist.name)) ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/14 px-3 py-2 text-sm font-medium text-emerald-200 dark:text-emerald-200">
                      Following
                    </span>
                  ) : (
                    <form action={followArtistAction}>
                      <input
                        name="musicbrainzArtistId"
                        type="hidden"
                        value={artist.musicbrainzArtistId ?? ""}
                      />
                      <input name="artistName" type="hidden" value={artist.name} />
                      <input
                        name="providerArtistId"
                        type="hidden"
                        value={artist.providerMappings[0]?.providerArtistId ?? ""}
                      />
                      <input
                        name="sourceProvider"
                        type="hidden"
                        value={artist.providerMappings[0]?.provider ?? ""}
                      />
                      <input
                        name="providerUrl"
                        type="hidden"
                        value={artist.providerMappings[0]?.url ?? ""}
                      />
                      <SubmitButton className="primary-button" pendingLabel="Adding...">
                        Follow
                      </SubmitButton>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Watchlist</p>
            <h2 className="text-3xl font-semibold text-[var(--text)]">Followed artists</h2>
          </div>
        </div>

        {followed.length === 0 ? (
          <EmptyState
            title="No followed artists yet"
            body="Use search here, then manage imports and provider connections in Settings."
          />
        ) : (
          <ArtistWatchlist followed={followed} timeZone={timeZone} />
        )}
      </section>
    </div>
  );
}
