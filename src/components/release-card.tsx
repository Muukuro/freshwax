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
    <article className="panel overflow-hidden">
      <div className="flex gap-4">
        <div
          className="release-art h-24 w-24 shrink-0 rounded-[0.45rem] bg-[linear-gradient(135deg,_rgba(45,109,246,0.24),_rgba(15,28,43,0.08))] bg-cover bg-center"
          style={release.coverUrl ? { backgroundImage: `url(${release.coverUrl})` } : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{releaseTypeLabel(release.type)}</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--text)]">{release.title}</h3>
              <p className="text-sm text-[var(--muted)]">{artistNames}</p>
            </div>
            <div className="rounded-full border border-[var(--date-chip-border)] bg-[var(--date-chip-bg)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              {formatReleaseDate(release.releaseDate)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            {showDiscoveredAt && discoveredAt && discoveredLate ? (
              <span className="status-pill">
                <Music4 className="h-4 w-4" />
                Found late {formatReleaseDate(discoveredAt)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
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
