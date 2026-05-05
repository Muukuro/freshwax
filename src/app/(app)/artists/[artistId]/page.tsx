import { Headphones, RefreshCw, UserMinus } from "lucide-react";
import { notFound } from "next/navigation";

import {
  syncFollowedArtistNowAction,
  unfollowArtistAction,
} from "@/app/actions/follows";
import { Artwork, initialsForName } from "@/components/artwork";
import { EmptyState } from "@/components/empty-state";
import { PlatformLink } from "@/components/platform-link";
import { ReleaseCard } from "@/components/release-card";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { getArtistDetail } from "@/lib/data";
import { formatInteger, formatTimestampInTimeZone } from "@/lib/timezone";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const [{ artistId }, user] = await Promise.all([params, requireUser()]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const detail = await getArtistDetail(user.id, artistId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="page-stack">
      <section className="panel flex flex-col gap-5 p-5 md:flex-row md:items-center">
        <Artwork
          alt={`${detail.artist.canonicalName} artist image`}
          className="h-24 w-24 shrink-0 rounded-[1.75rem] text-xl font-semibold text-[var(--text)]"
          fallback={initialsForName(detail.artist.canonicalName)}
          sizes="96px"
          src={detail.artist.imageUrl}
        />

        <div className="min-w-0 flex-1">
          <p className="eyebrow">Artist deeplink</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[var(--text)]">
            {detail.artist.canonicalName}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            {detail.artist.deezerFans ? (
              <span className="status-pill">
                <Headphones className="h-4 w-4" />
                {formatInteger(detail.artist.deezerFans)} Deezer listeners
              </span>
            ) : null}
            <span className="status-pill">
              {formatInteger(detail.artist.knownReleaseCount)} known releases
            </span>
            <span className="status-pill">
              Last synced{" "}
              {detail.artist.lastSyncedAt
                ? formatTimestampInTimeZone(detail.artist.lastSyncedAt, timeZone)
                : "not yet"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 md:justify-end">
          {detail.artist.platformLinks.map((link) => (
            <PlatformLink
              key={`${detail.artist.artistId}-${link.provider}`}
              className="ghost-button"
              href={link.href}
              label={link.label}
            />
          ))}
          <form action={syncFollowedArtistNowAction}>
            <input name="artistId" type="hidden" value={detail.artist.artistId} />
            <SubmitButton className="ghost-button" pendingLabel="Syncing...">
              <RefreshCw className="h-4 w-4" />
              Sync now
            </SubmitButton>
          </form>
          <form action={unfollowArtistAction}>
            <input name="artistId" type="hidden" value={detail.artist.artistId} />
            <SubmitButton className="ghost-button" pendingLabel="Removing...">
              <UserMinus className="h-4 w-4" />
              Unfollow
            </SubmitButton>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <div className="section-bar">
          <div>
            <p className="eyebrow">Release history</p>
            <h2 className="section-bar__title">Known releases for this artist</h2>
          </div>
        </div>
        {detail.releases.length === 0 ? (
          <EmptyState
            title="No visible releases"
            body="This artist has no releases matching your current filters yet."
          />
        ) : (
          detail.releases.map((release) => (
            <ReleaseCard key={release.id} release={release} timeZone={timeZone} />
          ))
        )}
      </section>
    </div>
  );
}
