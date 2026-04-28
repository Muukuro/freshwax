import { ArrowRight, CalendarClock, CalendarDays, Search, Sparkles, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { StatsCard } from "@/components/stats-card";
import { getDashboardData } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

export default async function DashboardPage() {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const data = await getDashboardData(user.id);

  return (
    <div className="page-stack">
      <section className="dashboard-command">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="dashboard-command__title">Release desk</h1>
          <p className="dashboard-command__body">
            {data.upcoming.length} upcoming, {data.discoveries.length} recent,{" "}
            {data.followedArtistsCount} followed artists.
          </p>
        </div>
        <div className="dashboard-command__actions">
          <a className="primary-button" href="/artists">
            <Search className="h-4 w-4" />
            Follow artists
          </a>
          <span className="status-pill status-pill--steady">
            {data.settings.futureHorizonDays}d ahead &middot; {data.settings.discoveryWindowDays}d back
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatsCard
          label="Followed artists"
          value={String(data.followedArtistsCount)}
          detail="Artists with active background sync coverage."
          icon={Users}
        />
        <StatsCard
          label="Upcoming releases"
          value={String(data.upcoming.length)}
          detail={`Within your ${data.settings.futureHorizonDays}-day calendar horizon.`}
          icon={CalendarDays}
        />
        <StatsCard
          label="Recent releases"
          value={String(data.discoveredReleasesCount)}
          detail={`Released in the last ${data.settings.discoveryWindowDays} days from artists you follow.`}
          icon={Sparkles}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="section-bar">
            <div>
              <p className="eyebrow">Upcoming</p>
              <h2 className="section-bar__title">Nearest release dates</h2>
            </div>
            <a className="ghost-button" href="/upcoming">
              <CalendarClock className="h-4 w-4" />
              View all
            </a>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState
              title="Nothing on the horizon yet"
              body="Follow a few artists from the search page and the worker will start filling this board with upcoming releases."
            />
          ) : (
            data.upcoming.map((release) => (
              <ReleaseCard key={release.id} release={release} timeZone={timeZone} />
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="section-bar">
            <div>
              <p className="eyebrow">Recent releases</p>
              <h2 className="section-bar__title">Latest releases from followed artists</h2>
            </div>
            <a className="ghost-button" href="/discoveries">
              <Sparkles className="h-4 w-4" />
              View feed
            </a>
          </div>
          {data.discoveries.length === 0 ? (
            <EmptyState
              title="No recent releases"
              body="Freshwax keeps this feed focused on the latest releases from artists you follow, while late finds are marked on the cards."
            />
          ) : (
            data.discoveries.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                showDiscoveredAt
                timeZone={timeZone}
              />
            ))
          )}
        </div>
      </section>

      <section className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Calendar feed</p>
          <p className="mt-2 text-base text-[var(--text)]">
            Subscribe with your private ICS URL in Apple Calendar, Google Calendar, or Fantastical.
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Ignored releases and your current filters stay reflected in the feed automatically.
          </p>
        </div>
        <a className="ghost-button" href="/settings">
          Manage token
          <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
