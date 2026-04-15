import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { getUpcomingReleases } from "@/lib/data";

export default async function UpcomingPage() {
  const user = await requireUser();
  const releases = await getUpcomingReleases(user.id);

  return (
    <div className="space-y-4">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Upcoming releases</p>
          <h2 className="text-3xl font-semibold text-[var(--text)]">Calendar-first release timeline</h2>
        </div>
      </div>

      {releases.length === 0 ? (
        <EmptyState
          title="No upcoming releases found"
          body="Either your followed artists do not have future release dates in Deezer yet, or your filters are excluding them."
        />
      ) : (
        releases.map((release) => <ReleaseCard key={release.id} release={release} />)
      )}
    </div>
  );
}
