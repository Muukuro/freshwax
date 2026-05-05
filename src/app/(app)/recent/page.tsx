import { ReleaseType } from "@prisma/client";
import { ArrowRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { ReleaseCard } from "@/components/release-card";
import { requireUser } from "@/lib/auth";
import {
  MORE_RECENT_RELEASE_TYPES,
  PRIMARY_RECENT_RELEASE_TYPES,
  getRecentReleasesPageData,
} from "@/lib/data";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { getDateOffsetUtcDateForTimeZone, getTodayUtcDateForTimeZone } from "@/lib/timezone";
import { releaseTypeLabel, toSentenceCase } from "@/lib/utils";

type RecentSearchParams = Promise<{
  types?: string | string[];
  ignored?: string | string[];
}>;

const FILTERABLE_TYPES = [
  ...PRIMARY_RECENT_RELEASE_TYPES,
  ...MORE_RECENT_RELEASE_TYPES,
];
type FilterableReleaseType = (typeof FILTERABLE_TYPES)[number];

function parseTypeValue(value: string) {
  const normalized = value.trim().toUpperCase();

  return FILTERABLE_TYPES.find((type) => type === normalized) ?? null;
}

function parseSelectedTypes(value: string | string[] | undefined) {
  if (!value) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : value.split(",");
  const selected = rawValues.flatMap((entry) => {
    const parsed = parseTypeValue(entry);
    return parsed ? [parsed] : [];
  });

  return selected.length > 0 ? [...new Set(selected)] : undefined;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildRecentHref(input: {
  releaseTypes?: ReleaseType[];
  showIgnored: boolean;
}) {
  const params = new URLSearchParams();

  if (input.releaseTypes && input.releaseTypes.length > 0) {
    params.set("types", input.releaseTypes.map((type) => type.toLowerCase()).join(","));
  }

  if (input.showIgnored) {
    params.set("ignored", "show");
  }

  const query = params.toString();
  return query ? `/recent?${query}` : "/recent";
}

function sameTypes(left: ReleaseType[], right: ReleaseType[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((type) => rightSet.has(type));
}

function groupRecentReleases<T extends { releaseDate: Date }>(
  releases: T[],
  timeZone: string,
) {
  const today = getTodayUtcDateForTimeZone(timeZone);
  const weekCutoff = getDateOffsetUtcDateForTimeZone(timeZone, -6);

  return [
    {
      key: "today",
      title: "Today",
      releases: releases.filter(
        (release) => release.releaseDate.getTime() === today.getTime(),
      ),
    },
    {
      key: "week",
      title: "This week",
      releases: releases.filter(
        (release) =>
          release.releaseDate.getTime() < today.getTime() &&
          release.releaseDate.getTime() >= weekCutoff.getTime(),
      ),
    },
    {
      key: "earlier",
      title: "Earlier",
      releases: releases.filter(
        (release) => release.releaseDate.getTime() < weekCutoff.getTime(),
      ),
    },
  ].filter((group) => group.releases.length > 0);
}

export default async function RecentPage({
  searchParams,
}: {
  searchParams: RecentSearchParams;
}) {
  const user = await requireUser();
  const timeZone = getEffectiveTimeZone(user.timezone);
  const params = await searchParams;
  const releaseTypes = parseSelectedTypes(params.types);
  const showIgnored = firstParam(params.ignored) === "show";
  const data = await getRecentReleasesPageData(user.id, {
    releaseTypes,
    showIgnored,
  });
  const selectedTypes = releaseTypes ?? data.defaultReleaseTypes;
  const selectedFilterTypes = FILTERABLE_TYPES.filter((type) => selectedTypes.includes(type));
  const defaultFilterTypes = FILTERABLE_TYPES.filter((type) =>
    data.defaultReleaseTypes.includes(type),
  );
  const usingTemporaryTypes =
    releaseTypes !== undefined && !sameTypes(selectedFilterTypes, defaultFilterTypes);
  const usingTemporaryFilters = usingTemporaryTypes || showIgnored;
  const groups = groupRecentReleases(data.releases, timeZone);
  const sparseDefaultView = data.defaultRecentReleasesCount <= 3;

  function hrefForType(type: FilterableReleaseType) {
    const selected = selectedFilterTypes.includes(type);
    const nextTypes = selected
      ? selectedFilterTypes.filter((entry) => entry !== type)
      : [...selectedFilterTypes, type];

    return buildRecentHref({
      releaseTypes: nextTypes.length === 0 ? undefined : nextTypes,
      showIgnored,
    });
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div className="page-intro__content">
          <p className="eyebrow">Recent releases</p>
          <h1 className="page-intro__title">Fresh from your watchlist</h1>
          <p className="page-intro__body">
            Releases from artists you follow, grouped by release date and filtered by your defaults unless you adjust this view.
          </p>
        </div>
        <Link className="ghost-button" href="/artists">
          <Search className="h-4 w-4" />
          Follow artists
        </Link>
      </div>

      <section className="panel recent-filter-panel">
        <div className="panel-heading">
          <div className="panel-heading__body">
            <p className="eyebrow">View filters</p>
            <h2 className="panel-heading__title">Temporary view</h2>
            <p className="panel-heading__text">
              These controls only affect this page. Settings still control defaults, calendar output, and notifications.
            </p>
          </div>
          {usingTemporaryFilters ? (
            <Link className="ghost-button" href="/recent">
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </Link>
          ) : null}
        </div>

        <div className="recent-filter-groups">
          <div>
            <p className="eyebrow">Format</p>
            <div className="filter-toggle-row">
              {PRIMARY_RECENT_RELEASE_TYPES.map((type) => {
                const selected = selectedFilterTypes.includes(type);

                return (
                  <Link
                    aria-pressed={selected}
                    className={`filter-toggle ${selected ? "filter-toggle--active" : ""}`}
                    href={hrefForType(type)}
                    key={type}
                  >
                    {toSentenceCase(releaseTypeLabel(type))}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="eyebrow">More</p>
            <div className="filter-toggle-row">
              {MORE_RECENT_RELEASE_TYPES.map((type) => {
                const selected = selectedFilterTypes.includes(type);

                return (
                  <Link
                    aria-pressed={selected}
                    className={`filter-toggle ${selected ? "filter-toggle--active" : ""}`}
                    href={hrefForType(type)}
                    key={type}
                  >
                    {toSentenceCase(releaseTypeLabel(type))}
                  </Link>
                );
              })}
              <Link
                aria-pressed={showIgnored}
                className={`filter-toggle ${showIgnored ? "filter-toggle--active" : ""}`}
                href={buildRecentHref({
                  releaseTypes,
                  showIgnored: !showIgnored,
                })}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Show ignored
              </Link>
            </div>
          </div>
        </div>
      </section>

      {sparseDefaultView ? (
        <section className="panel flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Watchlist</p>
            <p className="mt-2 text-base text-[var(--text)]">
              Your default recent view has {data.defaultRecentReleasesCount} releases.
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Follow more artists or import from a connected source to make this recent view fuller.
            </p>
          </div>
          <Link className="ghost-button" href="/artists">
            Follow more artists
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No recent releases"
          body="Try broadening the temporary filters, showing ignored releases, or following more artists."
        />
      ) : (
        groups.map((group) => (
          <section className="recent-date-group" key={group.key}>
            <div className="section-bar">
              <div>
                <p className="eyebrow">Released</p>
                <h2 className="section-bar__title">{group.title}</h2>
              </div>
            </div>
            <div className="recent-date-group__list">
              {group.releases.map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  showDiscoveredAt
                  timeZone={timeZone}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
