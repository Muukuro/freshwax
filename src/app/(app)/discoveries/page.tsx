import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import { getDiscoveredReleases } from "@/lib/data";

export default async function DiscoveriesPage() {
  const user = await requireUser();
  const releases = await getDiscoveredReleases(user.id);

  return (
    <div className="space-y-4">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Missed recently</p>
          <h2 className="text-3xl font-semibold text-[var(--text)]">Recent releases that surfaced after the fact</h2>
        </div>
      </div>

      {releases.length === 0 ? (
        <EmptyState
          title="No missed recent releases"
          body="This feed only keeps releases that came out within your discovery window and surfaced after you started tracking the artist."
        />
      ) : (
        releases.map((release) => (
          <ReleaseCard key={release.id} release={release} showDiscoveredAt />
        ))
      )}
    </div>
  );
}
