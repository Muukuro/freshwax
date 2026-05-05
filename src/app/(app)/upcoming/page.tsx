import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { getUpcomingReleases } from "@/lib/data";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

export default async function UpcomingPage() {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const releases = await getUpcomingReleases(user.id);
  const singlesHidden = user.settings?.includeSingles === false;
  const classicalComposerAppearancesHidden =
    user.settings?.hideClassicalComposerAppearances !== false;

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div className="page-intro__content">
          <p className="eyebrow">Upcoming releases</p>
          <h2 className="page-intro__title">Calendar-first release timeline</h2>
          <p className="page-intro__body">
            Scan future release dates first. Anything dated today moves to Recent Releases.
          </p>
          {singlesHidden ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Singles are hidden right now, so this timeline stays focused on full-length releases.
            </p>
          ) : null}
          {classicalComposerAppearancesHidden ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Classical composer appearances are hidden when the release looks like a new
              performance rather than a true new release from the followed artist.
            </p>
          ) : null}
        </div>
      </div>

      {releases.length === 0 ? (
        <EmptyState
          title="No upcoming releases found"
          body="Either your followed artists do not have future release dates in the current catalog sources yet, or your filters are excluding them."
        />
      ) : (
        releases.map((release, index) => (
          <ReleaseCard
            isAboveFold={index === 0}
            key={release.id}
            release={release}
            timeZone={timeZone}
          />
        ))
      )}
    </div>
  );
}
