const TIDAL_API = "https://openapi.tidal.com";

type TidalArtistResource = {
  id: string;
  type: string;
  attributes?: {
    name?: string;
    externalLinks?: { href?: string; meta?: { type?: string } }[];
  };
};

type TidalCollectionData = {
  id?: string;
  relationships?: {
    items?: {
      links?: {
        self?: string | { href?: string };
        next?: string | { href?: string };
      };
    };
  };
};

type TidalCollectionResponse = {
  data?: unknown[] | TidalCollectionData;
  included?: TidalArtistResource[];
  links?: Record<string, unknown>;
};

type TidalRelationshipResponse = {
  data?: { id: string; type: string }[];
  links?: {
    next?: string | { href?: string } | null;
  };
};

type TidalArtistsResponse = {
  data?: TidalArtistResource[];
};

function decodeJwtClaim(token: string, claim: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    return typeof payload[claim] === "string" ? payload[claim] : null;
  } catch {
    return null;
  }
}

function extractArtist(resource: TidalArtistResource) {
  if (resource.type !== "artists") return null;
  const name = resource.attributes?.name?.trim();
  if (!name) return null;

  const sharingLink = resource.attributes?.externalLinks?.find(
    (link) => link.meta?.type === "TIDAL_SHARING",
  );

  return {
    name,
    providerArtistId: resource.id,
    tidalUrl: sharingLink?.href ?? null,
  };
}

function resolveLinkHref(link: string | { href?: string } | null | undefined) {
  if (!link) return null;
  if (typeof link === "string") return link;
  return typeof link.href === "string" ? link.href : null;
}

async function tidalFetch(url: string, accessToken: string, attempt = 0): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
    const backoffMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 30_000);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return tidalFetch(url, accessToken, attempt + 1);
  }

  return response;
}

async function fetchArtistsByIds(
  ids: string[],
  countryCode: string,
  accessToken: string,
): Promise<TidalArtistResource[]> {
  if (ids.length === 0) return [];

  // Try batch filter first
  const batchUrl = new URL(`${TIDAL_API}/v2/artists`);
  batchUrl.searchParams.set("countryCode", countryCode);
  batchUrl.searchParams.set("locale", "en-US");
  batchUrl.searchParams.set("filter[id][in]", ids.join(","));

  const batchRes = await tidalFetch(batchUrl.toString(), accessToken);

  if (batchRes.ok) {
    const payload = (await batchRes.json()) as TidalArtistsResponse;
    return payload.data ?? [];
  }

  // Fall back to parallel individual fetches
  const results = await Promise.all(
    ids.map(async (id) => {
      const url = `${TIDAL_API}/v2/artists/${id}?countryCode=${countryCode}&locale=en-US`;
      const res = await tidalFetch(url, accessToken);
      if (!res.ok) return null;
      const payload = (await res.json()) as { data?: TidalArtistResource };
      return payload.data ?? null;
    }),
  );

  return results.filter((r): r is TidalArtistResource => r !== null);
}

export function buildTidalReleaseSearchUrl(artistName: string, releaseTitle: string) {
  const query = `${artistName} ${releaseTitle}`;
  return `https://listen.tidal.com/search?q=${encodeURIComponent(query)}`;
}

export async function fetchTidalFollowedArtists(accessToken: string) {
  const countryCode = decodeJwtClaim(accessToken, "cc") ?? "US";
  const artists: { name: string; providerArtistId: string; tidalUrl: string | null }[] = [];

  // Page 1: fetch the single collection resource with items included (returns up to 20 in `included`)
  const collectionUrl = `${TIDAL_API}/v2/userCollectionArtists/me?countryCode=${countryCode}&locale=en-US&include=items`;
  const collectionRes = await tidalFetch(collectionUrl, accessToken);

  if (!collectionRes.ok) {
    throw new Error(`TIDAL collection fetch failed with ${collectionRes.status}`);
  }

  const collection = (await collectionRes.json()) as TidalCollectionResponse;

  for (const resource of collection.included ?? []) {
    const artist = extractArtist(resource);
    if (artist) artists.push(artist);
  }

  // Locate the collection ID and the next cursor from the relationship links
  const collectionData =
    !Array.isArray(collection.data) &&
    typeof collection.data === "object" &&
    collection.data !== null
      ? (collection.data as TidalCollectionData)
      : null;

  const relationshipNextUrl = resolveLinkHref(collectionData?.relationships?.items?.links?.next);

  if (!relationshipNextUrl) {
    return artists;
  }

  // Pages 2+: walk /relationships/items for IDs, then batch-fetch artist details
  let nextUrl: string | null = relationshipNextUrl.startsWith("http")
    ? relationshipNextUrl
    : `${TIDAL_API}/v2${relationshipNextUrl}`;
  let pages = 0;

  while (nextUrl && pages < 100) {
    const relRes = await tidalFetch(nextUrl, accessToken);

    if (!relRes.ok) {
      console.error(`[TIDAL] relationships page ${pages + 1} failed with ${relRes.status}`);
      break;
    }

    const relPayload = (await relRes.json()) as TidalRelationshipResponse;
    const ids = (relPayload.data ?? []).map((ref) => ref.id);

    const fetched = await fetchArtistsByIds(ids, countryCode, accessToken);
    for (const resource of fetched) {
      const artist = extractArtist(resource);
      if (artist) artists.push(artist);
    }

    const rawNext = resolveLinkHref(relPayload.links?.next);
    nextUrl = rawNext
      ? rawNext.startsWith("http")
        ? rawNext
        : `${TIDAL_API}/v2${rawNext}`
      : null;

    pages += 1;
  }

  return artists;
}
