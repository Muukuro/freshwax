import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { artistPath } from "@/lib/deeplinks";
import { getReleaseDetail } from "@/lib/data";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  const [{ releaseId }, user] = await Promise.all([params, requireUser()]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const release = await getReleaseDetail(user.id, releaseId);

  if (!release) {
    notFound();
  }

  return (
    <div className="page-stack">
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

      <ReleaseCard release={release} showDiscoveredAt timeZone={timeZone} />
    </div>
  );
}
