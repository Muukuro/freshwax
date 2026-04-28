import { type Release } from "@prisma/client";
import { EyeOff, Music4 } from "lucide-react";

import {
  ignoreReleaseAction,
  unignoreReleaseAction,
} from "@/app/actions/follows";
import { PlatformLink } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { type PlatformLinkEntry } from "@/lib/data";
import { formatReleaseDate, isDiscoveredLate } from "@/lib/timezone";
import { releaseTypeLabel } from "@/lib/utils";

type ReleaseWithArtists = Release & {
  artists: { artist: { canonicalName: string } }[];
  discoveries?: { discoveredAt: Date }[];
  ignoredBy?: { releaseId: string }[];
  platformLinks?: PlatformLinkEntry[];
};

export function ReleaseCard({
  release,
  showDiscoveredAt = false,
  timeZone,
}: {
  release: ReleaseWithArtists;
  showDiscoveredAt?: boolean;
  timeZone: string;
}) {
  const artistNames = release.artists.map((entry) => entry.artist.canonicalName).join(", ");
  const ignored = (release.ignoredBy?.length ?? 0) > 0;
  const discoveredAt = release.discoveries?.[0]?.discoveredAt ?? null;
  const discoveredLate =
    discoveredAt !== null && isDiscoveredLate(discoveredAt, release.releaseDate, timeZone);

  return (
    <article className="panel release-card overflow-hidden">
      <div className="release-card__grid">
        <div
          className="release-art release-art--fallback release-card__art shrink-0 bg-cover bg-center"
          style={release.coverUrl ? { backgroundImage: `url(${release.coverUrl})` } : undefined}
        />
        <div className="release-card__meta">
          <div className="release-card__topline">
            <div className="release-card__header">
              <p className="eyebrow">{releaseTypeLabel(release.type)}</p>
              <h3 className="release-card__title">{release.title}</h3>
              <p className="release-card__artist">{artistNames}</p>
            </div>
            <div className="release-card__date">
              {formatReleaseDate(release.releaseDate)}
            </div>
          </div>

          <div className="release-card__signals">
            {showDiscoveredAt && discoveredAt && discoveredLate ? (
              <span className="status-pill">
                <Music4 className="h-4 w-4" />
                Found late {formatReleaseDate(discoveredAt)}
              </span>
            ) : null}
            {ignored ? <span className="status-pill">Ignored</span> : null}
          </div>

          <div className="release-card__actions">
            {(release.platformLinks ?? []).map((link) => (
              <PlatformLink
                key={`${release.id}-${link.provider}`}
                className="ghost-button"
                href={link.href}
                label={link.label}
              />
            ))}

            <form action={ignored ? unignoreReleaseAction : ignoreReleaseAction}>
              <input name="releaseId" type="hidden" value={release.id} />
              <SubmitButton className="ghost-button" pendingLabel="Saving...">
                <EyeOff className="h-4 w-4" />
                {ignored ? "Restore" : "Ignore"}
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}
