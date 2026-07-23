import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ProviderMappingCorrectionPanel } from "@/components/provider-mapping-correction-panel";
import { ReleaseDuplicatePanel } from "@/components/release-duplicate-panel";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { artistPath } from "@/lib/deeplinks";
import { getReleaseDetail } from "@/lib/data";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { findDuplicateReleaseCandidates } from "@/lib/release-duplicates";

export default async function ReleaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ releaseId: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const [{ releaseId }, query, user] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const [release, duplicateCandidates] = await Promise.all([
    getReleaseDetail(user.id, releaseId),
    findDuplicateReleaseCandidates(user.id, releaseId),
  ]);

  if (!release) {
    notFound();
  }

  return (
    <div className="page-stack">
      {query.duplicate === "merged" ? (
        <div className="panel-muted p-4 text-sm text-[var(--text)]" role="status">
          The duplicate was merged into this release and its related history was
          preserved.
        </div>
      ) : null}

      <div className="page-intro">
        <div className="page-intro__content">
          <p className="eyebrow">Release details</p>
          <h1 className="page-intro__title">{release.title}</h1>
          <p className="page-intro__body">
            Follow this release across notifications, calendar events, and local bookmarks.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            {release.artists.map((entry) => (
              <Link
                key={entry.artist.id}
                className="status-pill hover:text-[var(--text)]"
                href={artistPath(entry.artist.id)}
              >
                {entry.artist.canonicalName}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {!release.visibleForCurrentFilters ? (
        <EmptyState
          title="Hidden by current filters"
          body="This release is still available by direct link, but one of your current filters would keep it out of the main feeds."
        />
      ) : null}

      <ReleaseCard isAboveFold release={release} showDiscoveredAt timeZone={timeZone} />

      <ProviderMappingCorrectionPanel
        mappings={release.mappings}
        target="release"
        targetId={release.id}
      />

      <ReleaseDuplicatePanel
        candidates={duplicateCandidates}
        releaseId={release.id}
      />
    </div>
  );
}
