import { Provider } from "@prisma/client";

const MB_API = "https://musicbrainz.org/ws/2";
// MusicBrainz requires a descriptive User-Agent per their API terms.
const USER_AGENT = "freshwax/1.0 (self-hosted music release tracker)";

type MbRelation = {
  "target-type": string;
  artist?: { id: string };
  release?: { id: string };
  "release-group"?: { id: string };
  url?: { resource: string };
};

type MbUrlEntityResponse = {
  relations?: MbRelation[];
};

type MbArtistResponse = {
  relations?: MbRelation[];
};

type MbSearchResponse = {
  artists?: { id: string; name: string; score: number }[];
};

export type MbPlatformMapping = {
  provider: Provider;
  providerArtistId: string;
  url: string;
};

async function mbFetch(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz request failed: ${response.status} ${url}`);
  }

  return response.json();
}

/**
 * Look up a MusicBrainz artist ID (MBID) by an exact provider URL.
 * MusicBrainz stores canonical URLs for each streaming platform as URL entities.
 * The URL must match exactly what MB stores (e.g. tidal.com, not listen.tidal.com).
 */
export async function lookupMbidByUrl(resourceUrl: string): Promise<string | null> {
  const data = (await mbFetch(
    `${MB_API}/url?resource=${encodeURIComponent(resourceUrl)}&inc=artist-rels&fmt=json`,
  )) as MbUrlEntityResponse;

  const artistRel = data.relations?.find(
    (r) => r["target-type"] === "artist" && r.artist?.id,
  );

  return artistRel?.artist?.id ?? null;
}

/**
 * Search MusicBrainz for an artist by name. Returns the MBID of the best match
 * (highest score), or null if no results. Name search is inherently ambiguous —
 * callers should prefer URL-based lookup when a provider ID is available.
 */
export async function searchArtistMbid(artistName: string): Promise<string | null> {
  const data = (await mbFetch(
    `${MB_API}/artist?query=${encodeURIComponent(artistName)}&limit=1&fmt=json`,
  )) as MbSearchResponse;

  return data.artists?.[0]?.id ?? null;
}

function parsePlatformUrl(rawUrl: string): MbPlatformMapping | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const { hostname, pathname } = parsed;
  const segments = pathname.split("/").filter(Boolean);

  // Spotify: open.spotify.com/artist/{id}
  if (hostname === "open.spotify.com" && segments[0] === "artist" && segments[1]) {
    return { provider: Provider.SPOTIFY, providerArtistId: segments[1], url: rawUrl };
  }

  // Apple Music: music.apple.com/{storefront}/artist/{id}
  // or music.apple.com/{storefront}/artist/{name}/{id} (id is always numeric)
  if (hostname === "music.apple.com" && segments[1] === "artist") {
    const candidate = segments[segments.length - 1];
    if (candidate && /^\d+$/.test(candidate)) {
      return { provider: Provider.APPLE_MUSIC, providerArtistId: candidate, url: rawUrl };
    }
  }

  // TIDAL: tidal.com/artist/{id} or listen.tidal.com/artist/{id}
  if (
    (hostname === "tidal.com" || hostname === "www.tidal.com" || hostname === "listen.tidal.com") &&
    segments[0] === "artist" &&
    segments[1]
  ) {
    return { provider: Provider.TIDAL, providerArtistId: segments[1], url: rawUrl };
  }

  // YouTube Music: music.youtube.com/channel/{id}
  if (hostname === "music.youtube.com" && segments[0] === "channel" && segments[1]) {
    return { provider: Provider.YOUTUBE_MUSIC, providerArtistId: segments[1], url: rawUrl };
  }

  // Amazon Music: music.amazon.com/artists/{id}
  if (hostname === "music.amazon.com" && segments[0] === "artists" && segments[1]) {
    return { provider: Provider.AMAZON_MUSIC, providerArtistId: segments[1], url: rawUrl };
  }

  // Deezer: www.deezer.com/artist/{id}
  if (
    (hostname === "deezer.com" || hostname === "www.deezer.com") &&
    segments[0] === "artist" &&
    segments[1]
  ) {
    return { provider: Provider.DEEZER, providerArtistId: segments[1], url: rawUrl };
  }

  return null;
}

export type MbReleasePlatformMapping = {
  provider: Provider;
  providerReleaseId: string;
  url: string;
};

function parsePlatformReleaseUrl(rawUrl: string): MbReleasePlatformMapping | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const { hostname, pathname } = parsed;
  const segments = pathname.split("/").filter(Boolean);

  // Spotify: open.spotify.com/album/{id}
  if (hostname === "open.spotify.com" && segments[0] === "album" && segments[1]) {
    return { provider: Provider.SPOTIFY, providerReleaseId: segments[1], url: rawUrl };
  }

  // Apple Music: music.apple.com/{storefront}/album/{name}/{id} — id is always numeric, at the end
  if (hostname === "music.apple.com" && segments[1] === "album") {
    const candidate = segments[segments.length - 1];
    if (candidate && /^\d+$/.test(candidate)) {
      return { provider: Provider.APPLE_MUSIC, providerReleaseId: candidate, url: rawUrl };
    }
  }

  // TIDAL: tidal.com/album/{id} or listen.tidal.com/album/{id}
  if (
    (hostname === "tidal.com" || hostname === "www.tidal.com" || hostname === "listen.tidal.com") &&
    segments[0] === "album" &&
    segments[1]
  ) {
    return { provider: Provider.TIDAL, providerReleaseId: segments[1], url: rawUrl };
  }

  // Amazon Music: music.amazon.com/albums/{id}
  if (hostname === "music.amazon.com" && segments[0] === "albums" && segments[1]) {
    return { provider: Provider.AMAZON_MUSIC, providerReleaseId: segments[1], url: rawUrl };
  }

  return null;
}

/**
 * Fetch streaming platform mappings for a release given its Deezer album ID.
 * MusicBrainz stores streaming URLs at the release-group level for most services;
 * falls back to release-level if no release-group match is found.
 * Returns an empty array on any lookup failure.
 */
export async function fetchMbReleasePlatformMappings(
  deezerAlbumId: string,
): Promise<MbReleasePlatformMapping[]> {
  const deezerUrl = `https://www.deezer.com/album/${deezerAlbumId}`;

  // Try release-group first — most streaming services are linked at this level in MB.
  try {
    const urlData = (await mbFetch(
      `${MB_API}/url?resource=${encodeURIComponent(deezerUrl)}&inc=release-group-rels&fmt=json`,
    )) as MbUrlEntityResponse;

    const rgRel = urlData.relations?.find(
      (r) => r["target-type"] === "release_group" && r["release-group"]?.id,
    );

    if (rgRel?.["release-group"]?.id) {
      const rgData = (await mbFetch(
        `${MB_API}/release-group/${rgRel["release-group"].id}?inc=url-rels&fmt=json`,
      )) as { relations?: MbRelation[] };

      const mappings: MbReleasePlatformMapping[] = [];
      for (const rel of rgData.relations ?? []) {
        if (rel["target-type"] !== "url" || !rel.url?.resource) continue;
        const mapping = parsePlatformReleaseUrl(rel.url.resource);
        if (mapping) mappings.push(mapping);
      }
      if (mappings.length > 0) return mappings;
    }
  } catch {
    // fall through to release-level attempt
  }

  // Fall back to release-level.
  try {
    const urlData = (await mbFetch(
      `${MB_API}/url?resource=${encodeURIComponent(deezerUrl)}&inc=release-rels&fmt=json`,
    )) as MbUrlEntityResponse;

    const relRel = urlData.relations?.find(
      (r) => r["target-type"] === "release" && r.release?.id,
    );

    if (!relRel?.release?.id) return [];

    const relData = (await mbFetch(
      `${MB_API}/release/${relRel.release.id}?inc=url-rels&fmt=json`,
    )) as { relations?: MbRelation[] };

    const mappings: MbReleasePlatformMapping[] = [];
    for (const rel of relData.relations ?? []) {
      if (rel["target-type"] !== "url" || !rel.url?.resource) continue;
      const mapping = parsePlatformReleaseUrl(rel.url.resource);
      if (mapping) mappings.push(mapping);
    }
    return mappings;
  } catch {
    return [];
  }
}

/**
 * Fetch streaming platform mappings for an artist given their MusicBrainz ID.
 */
export async function fetchMbPlatformMappingsByMbid(mbid: string): Promise<MbPlatformMapping[]> {
  let data: MbArtistResponse;
  try {
    data = (await mbFetch(
      `${MB_API}/artist/${mbid}?inc=url-rels&fmt=json`,
    )) as MbArtistResponse;
  } catch {
    return [];
  }

  const mappings: MbPlatformMapping[] = [];
  for (const relation of data.relations ?? []) {
    if (relation["target-type"] !== "url" || !relation.url?.resource) continue;
    const mapping = parsePlatformUrl(relation.url.resource);
    if (mapping) mappings.push(mapping);
  }

  return mappings;
}
