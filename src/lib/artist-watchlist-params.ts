export type ArtistsSearchParams = {
  q?: string | string[];
  watchlist?: string | string[];
  watchlistPage?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseArtistsSearchParams(params: ArtistsSearchParams) {
  return {
    catalogQuery: firstParam(params.q)?.trim() ?? "",
    watchlistQuery: firstParam(params.watchlist)?.trim() ?? "",
    watchlistPage: parsePage(firstParam(params.watchlistPage)),
  };
}

export function buildArtistsHref({
  catalogQuery = "",
  watchlistQuery = "",
  watchlistPage = 1,
}: {
  catalogQuery?: string;
  watchlistQuery?: string;
  watchlistPage?: number;
}) {
  const params = new URLSearchParams();
  const trimmedCatalogQuery = catalogQuery.trim();
  const trimmedWatchlistQuery = watchlistQuery.trim();

  if (trimmedCatalogQuery) {
    params.set("q", trimmedCatalogQuery);
  }

  if (trimmedWatchlistQuery) {
    params.set("watchlist", trimmedWatchlistQuery);
  }

  if (watchlistPage > 1) {
    params.set("watchlistPage", String(watchlistPage));
  }

  const query = params.toString();
  return query ? `/artists?${query}` : "/artists";
}

export function getPaginationItems(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  const sortedPages = [...pages].sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}
