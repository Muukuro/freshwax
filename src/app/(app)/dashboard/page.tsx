import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { StatsCard } from "@/components/stats-card";
import { getDashboardData } from "@/lib/data";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  return (
    <div className="space-y-8">
      <section className="hero-card">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">Dashboard</p>
          <h2 className="font-display mt-3 max-w-2xl text-5xl leading-[0.92] tracking-[-0.05em] text-white md:text-6xl">
            Keep a private watchlist and catch releases before they disappear into the feed.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-blue-100/78">
            Freshwax now treats listening platforms as preferences instead of hard-coded defaults, and
            a background worker keeps your feed fresh without manual refreshes.
          </p>
        </div>
        <div className="relative z-10 flex flex-col justify-between gap-6 md:max-w-xs md:items-end">
          <div className="rounded-[1rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">At a glance</p>
            <p className="mt-2 text-sm leading-7 text-blue-100/76">
              Track what is coming, what arrived late, and let Freshwax queue background sync when
              your watchlist needs a refresh.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatsCard
          label="Followed artists"
          value={String(data.followedArtistsCount)}
          detail="Artists with active background sync coverage."
        />
        <StatsCard
          label="Upcoming releases"
          value={String(data.upcoming.length)}
          detail={`Within your ${data.settings.futureHorizonDays}-day calendar horizon.`}
        />
        <StatsCard
          label="Recent discoveries"
          value={String(data.discoveredReleasesCount)}
          detail={`Found in the last ${data.settings.discoveryWindowDays} days after you started tracking them.`}
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Upcoming</p>
              <h3 className="text-2xl font-semibold text-[var(--text)]">Nearest release dates</h3>
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
            data.upcoming.map((release) => <ReleaseCard key={release.id} release={release} />)
          )}
        </div>

          <div className="space-y-4">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Missed recently</p>
              <h3 className="text-2xl font-semibold text-[var(--text)]">Recent releases surfaced late</h3>
            </div>
            <a className="ghost-button" href="/discoveries">
              <Sparkles className="h-4 w-4" />
              View feed
            </a>
          </div>
          {data.discoveries.length === 0 ? (
            <EmptyState
              title="No missed recent releases"
              body="Freshwax only treats recent releases as discoveries, so deep back-catalog imports stay out of this feed."
            />
          ) : (
            data.discoveries.map((release) => (
              <ReleaseCard key={release.id} release={release} showDiscoveredAt />
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
        </div>
        <a className="ghost-button" href="/settings">
          Manage token
          <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
