import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { getDiscoveredReleases } from "@/lib/data";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

export default async function DiscoveriesPage() {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const releases = await getDiscoveredReleases(user.id);
  const singlesHidden = user.settings?.includeSingles === false;
  const classicalComposerAppearancesHidden =
    user.settings?.hideClassicalComposerAppearances !== false;

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div className="page-intro__content">
          <p className="eyebrow">Recent releases</p>
          <h2 className="page-intro__title">What landed recently from your watchlist</h2>
          <p className="page-intro__body">
            This feed stays focused on fresh arrivals from artists you follow, with late finds marked quietly instead of turning into alerts everywhere.
          </p>
          {singlesHidden ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Singles are hidden right now, so this feed only shows full-length releases and any other enabled types.
            </p>
          ) : null}
          {classicalComposerAppearancesHidden ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Classical composer appearances are hidden when the release looks like a fresh
              performance of an older composer&apos;s work.
            </p>
          ) : null}
        </div>
      </div>

      {releases.length === 0 ? (
        <EmptyState
          title="No recent releases"
          body="This feed only keeps releases from the last few weeks, based on your discovery window. Late finds still get a badge when Freshwax surfaced them after release day."
        />
      ) : (
        releases.map((release) => (
          <ReleaseCard key={release.id} release={release} showDiscoveredAt timeZone={timeZone} />
        ))
      )}
    </div>
  );
}
