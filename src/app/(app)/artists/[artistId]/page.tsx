import { Check, Headphones, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";

import {
  followArtistAction,
  syncFollowedArtistNowAction,
  unfollowArtistAction,
} from "@/app/actions/follows";
import { Artwork } from "@/components/artwork";
import { EmptyState } from "@/components/empty-state";
import { PlatformLink } from "@/components/platform-link";
import { ProviderMappingCorrectionPanel } from "@/components/provider-mapping-correction-panel";
import { ReleaseCard } from "@/components/release-card";
import { SubmitButton } from "@/components/submit-button";
import { initialsForName } from "@/lib/artwork";
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
      <section className="panel artist-masthead">
        <Artwork
          alt={`${detail.artist.canonicalName} artist image`}
          className="artist-masthead__art text-xl font-semibold text-[var(--text)]"
          fallback={initialsForName(detail.artist.canonicalName)}
          height={96}
          isAboveFold
          sizes="96px"
          src={detail.artist.imageUrl}
          width={96}
        />

        <div className="artist-masthead__content">
          <p className="eyebrow">Artist deeplink</p>
          <h1 className="artist-masthead__title">
            {detail.artist.canonicalName}
          </h1>
          <div className="artist-masthead__meta">
            {detail.artist.deezerFans ? (
              <span className="status-pill">
                <Headphones className="h-4 w-4" />
                {formatInteger(detail.artist.deezerFans)} Deezer listeners
              </span>
            ) : null}
            <span className="status-pill">
              {formatInteger(detail.artist.knownReleaseCount)} known releases
            </span>
            <span
              className={
                detail.artist.isFollowed
                  ? "status-pill text-emerald-700 dark:text-emerald-200"
                  : "status-pill"
              }
            >
              {detail.artist.isFollowed ? (
                <>
                  <Check className="h-4 w-4" />
                  Following
                </>
              ) : (
                "Not followed"
              )}
            </span>
            {detail.artist.isFollowed ? (
              <span className="status-pill">
                Last synced{" "}
                {detail.artist.lastSyncedAt
                  ? formatTimestampInTimeZone(detail.artist.lastSyncedAt, timeZone)
                  : "not yet"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="artist-masthead__actions">
          {detail.artist.platformLinks.map((link) => (
            <PlatformLink
              key={`${detail.artist.artistId}-${link.provider}`}
              className="ghost-button"
              href={link.href}
              label={link.label}
            />
          ))}
          {detail.artist.isFollowed ? (
            <>
              <form action={syncFollowedArtistNowAction}>
                <input name="artistId" type="hidden" value={detail.artist.artistId} />
                <SubmitButton className="ghost-button" pendingLabel="Syncing...">
                  <RefreshCw className="h-4 w-4" />
                  Sync now
                </SubmitButton>
              </form>
              <form action={unfollowArtistAction}>
                <input name="artistId" type="hidden" value={detail.artist.artistId} />
                <input name="redirectTo" type="hidden" value="/artists" />
                <SubmitButton className="ghost-button" pendingLabel="Removing...">
                  <UserMinus className="h-4 w-4" />
                  Unfollow
                </SubmitButton>
              </form>
            </>
          ) : (
            <form action={followArtistAction}>
              <input
                name="musicbrainzArtistId"
                type="hidden"
                value={detail.artist.musicbrainzArtistId}
              />
              <input
                name="artistName"
                type="hidden"
                value={detail.artist.canonicalName}
              />
              <SubmitButton className="primary-button" pendingLabel="Adding...">
                <UserPlus className="h-4 w-4" />
                Follow
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      {detail.artist.isFollowed ? (
        <ProviderMappingCorrectionPanel
          mappings={detail.artist.mappings}
          target="artist"
          targetId={detail.artist.artistId}
        />
      ) : null}

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
          detail.releases.map((release, index) => (
            <ReleaseCard
              isAboveFold={index === 0}
              key={release.id}
              release={release}
              timeZone={timeZone}
            />
          ))
        )}
      </section>
    </div>
  );
}
