import { type Release } from "@prisma/client";
import { EyeOff, Music4 } from "lucide-react";
import Link from "next/link";

import {
  ignoreReleaseAction,
  unignoreReleaseAction,
} from "@/app/actions/follows";
import { Artwork } from "@/components/artwork";
import { PlatformLink } from "@/components/platform-link";
import { SubmitButton } from "@/components/submit-button";
import { type PlatformLinkEntry } from "@/lib/data";
import { artistPath, releasePath } from "@/lib/deeplinks";
import { formatReleaseDate, isDiscoveredLate } from "@/lib/timezone";
import { releaseTypeLabel } from "@/lib/utils";

type ReleaseWithArtists = Release & {
  artists: { artist: { id: string; canonicalName: string } }[];
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
  const [primaryPlatformLink, ...secondaryPlatformLinks] = release.platformLinks ?? [];

  return (
    <article className="panel release-card overflow-hidden">
      <div className="release-card__grid">
        <Artwork
          alt={`${release.title} cover art`}
          className="release-card__art shrink-0"
          sizes="72px"
          src={release.coverUrl}
        />
        <div className="release-card__meta">
          <div className="release-card__topline">
            <div className="release-card__header">
              <p className="eyebrow">{releaseTypeLabel(release.type)}</p>
              <h3 className="release-card__title">
                <Link href={releasePath(release.id)}>{release.title}</Link>
              </h3>
              <p className="release-card__artist">
                {release.artists.map((entry, index) => (
                  <span key={entry.artist.id}>
                    {index > 0 ? ", " : ""}
                    <Link href={artistPath(entry.artist.id)}>{entry.artist.canonicalName}</Link>
                  </span>
                ))}
                {release.artists.length === 0 ? artistNames : null}
              </p>
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
            {primaryPlatformLink ? (
              <PlatformLink
                className="primary-button"
                href={primaryPlatformLink.href}
                label={`${primaryPlatformLink.exact ? "Listen on" : "Search on"} ${primaryPlatformLink.label}`}
              />
            ) : null}

            {secondaryPlatformLinks.map((link) => (
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
