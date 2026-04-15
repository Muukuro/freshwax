import { Link2, Search, UserMinus } from "lucide-react";

import {
  followArtistAction,
  importDeezerFollowsAction,
  importLastfmArtistsAction,
  unfollowArtistAction,
} from "@/app/actions/follows";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { getFollowedArtists } from "@/lib/data";
import { isDeezerOAuthConfigured, searchArtists } from "@/lib/providers/deezer";
import { isLastfmConfigured } from "@/lib/providers/lastfm";

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const followed = await getFollowedArtists(user.id);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await searchArtists(query) : [];
  const deezerConfigured = isDeezerOAuthConfigured();
  const lastfmConfigured = isLastfmConfigured();
  const followedProviderIds = new Set(
    followed.flatMap((entry) =>
      entry.artist.mappings
        .filter((mapping) => mapping.provider === "DEEZER")
        .map((mapping) => mapping.providerArtistId),
    ),
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Artist search</p>
            <h2 className="text-3xl font-semibold text-[var(--text)]">Add artists from Deezer</h2>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="panel space-y-4 text-sm leading-7 text-[var(--muted)]">
            <div>
              <p className="eyebrow">Import source</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">Last.fm top artists</h3>
            </div>
            <p>
              Import from your saved Last.fm username. Freshwax resolves those artist names into the
              Deezer catalog, follows exact matches, and queues the usual sync jobs.
            </p>
            <div className="panel-muted p-4">
              {user.lastfmConnection ? (
                <>
                  Saved as{" "}
                  <span className="font-medium text-[var(--text)]">
                    {user.lastfmConnection.lastfmUserName}
                  </span>
                  . Last imported{" "}
                  {user.lastfmConnection.lastImportedAt
                    ? user.lastfmConnection.lastImportedAt.toLocaleString()
                    : "never"}
                  .
                </>
              ) : lastfmConfigured ? (
                "Add your Last.fm username in Settings to import your top artists."
              ) : (
                "Last.fm import is disabled until LASTFM_API_KEY is configured."
              )}
            </div>
            {user.lastfmConnection ? (
              <form action={importLastfmArtistsAction}>
                <SubmitButton className="ghost-button" pendingLabel="Importing...">
                  <Link2 className="h-4 w-4" />
                  Import from Last.fm
                </SubmitButton>
              </form>
            ) : null}
          </article>

          <article className="panel space-y-4 text-sm leading-7 text-[var(--muted)]">
            <div>
              <p className="eyebrow">Import source</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">
                Deezer followed artists
              </h3>
            </div>
            <p>
              Deezer import still works if you already have a valid Deezer app and a linked account,
              but it is no longer the only practical way to seed a watchlist.
            </p>
            <div className="panel-muted p-4">
              {user.deezerConnection ? (
                <>
                  Connected as{" "}
                  <span className="font-medium text-[var(--text)]">
                    {user.deezerConnection.deezerUserName ??
                      `User ${user.deezerConnection.deezerUserId}`}
                  </span>
                  .
                </>
              ) : deezerConfigured ? (
                "Link Deezer in Settings if you already have working OAuth credentials."
              ) : (
                "Deezer OAuth is disabled until DEEZER_APP_ID and DEEZER_APP_SECRET are configured."
              )}
            </div>
            {user.deezerConnection ? (
              <form action={importDeezerFollowsAction}>
                <SubmitButton className="ghost-button" pendingLabel="Importing...">
                  <Link2 className="h-4 w-4" />
                  Import from Deezer
                </SubmitButton>
              </form>
            ) : deezerConfigured ? (
              <a className="ghost-button" href="/api/deezer/connect">
                <Link2 className="h-4 w-4" />
                Connect Deezer
              </a>
            ) : null}
          </article>
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

        <div className="space-y-3">
          {query && results.length === 0 ? (
            <EmptyState
              title="No Deezer matches"
              body="Try a different spelling or a more specific artist name."
            />
          ) : (
            results.map((artist) => (
              <article key={artist.providerArtistId} className="panel flex items-center gap-4">
                <div
                  className="release-art h-16 w-16 rounded-[1.2rem] bg-cover bg-center"
                  style={
                    artist.imageUrl
                      ? { backgroundImage: `url(${artist.imageUrl})` }
                      : {
                          background:
                            "linear-gradient(135deg, rgba(45,109,246,0.22), rgba(15,28,43,0.08))",
                        }
                  }
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text)]">{artist.name}</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {artist.deezerFans?.toLocaleString() ?? "Unknown"} Deezer listeners
                  </p>
                </div>
                {followedProviderIds.has(artist.providerArtistId) ? (
                  <span className="rounded-full border border-emerald-700/18 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">
                    Following
                  </span>
                ) : (
                  <form action={followArtistAction}>
                    <input name="providerArtistId" type="hidden" value={artist.providerArtistId} />
                    <input name="query" type="hidden" value={query} />
                    <SubmitButton className="primary-button" pendingLabel="Adding...">
                      Follow
                    </SubmitButton>
                  </form>
                )}
              </article>
            ))
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
            title="Your watchlist is empty"
            body="Search for artists on the left or import them from Last.fm or Deezer, then the worker will start collecting release metadata."
          />
        ) : (
          followed.map((follow) => (
            <article key={follow.artistId} className="panel">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-[var(--text)]">
                    {follow.artist.canonicalName}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Last synced{" "}
                    {follow.lastSyncedAt ? follow.lastSyncedAt.toLocaleString() : "not yet"}
                  </p>
                </div>
                <form action={unfollowArtistAction}>
                  <input name="artistId" type="hidden" value={follow.artistId} />
                  <SubmitButton className="ghost-button" pendingLabel="Removing...">
                    <UserMinus className="h-4 w-4" />
                    Unfollow
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
