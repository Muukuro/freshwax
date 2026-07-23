"use client";

import { Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buildArtistsHref } from "@/lib/artist-watchlist-params";
import { formatInteger } from "@/lib/timezone";

export function ArtistWatchlistFilter({
  catalogQuery,
  matchingCount,
  totalCount,
  watchlistQuery,
}: {
  catalogQuery: string;
  matchingCount: number;
  totalCount: number;
  watchlistQuery: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(watchlistQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFilter(watchlistQuery);
  }, [watchlistQuery]);

  useEffect(() => {
    if (filter.trim() === watchlistQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          buildArtistsHref({
            catalogQuery,
            watchlistQuery: filter,
          }),
          { scroll: false },
        );
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [catalogQuery, filter, router, watchlistQuery]);

  return (
    <div className="watchlist-filter-shell">
      <label className="field flex-1">
        <span className="watchlist-filter-label">Filter followed artists</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            aria-busy={isPending}
            className="watchlist-filter-input"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by artist name"
            type="search"
            value={filter}
          />
        </div>
      </label>
      <p aria-live="polite" className="watchlist-filter-meta">
        {watchlistQuery
          ? `${formatInteger(matchingCount)} of ${formatInteger(totalCount)} artists match`
          : `${formatInteger(totalCount)} artists followed`}
        {isPending ? " · Updating…" : ""}
      </p>
    </div>
  );
}
