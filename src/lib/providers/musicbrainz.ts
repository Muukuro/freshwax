import { Provider } from "@prisma/client";

import { env } from "@/lib/env";

const MB_API = "https://musicbrainz.org/ws/2";
// MusicBrainz asks for a descriptive, contactable User-Agent.
const USER_AGENT = `Freshwax/0.1.0 (${env.APP_URL})`;
const MB_MIN_REQUEST_INTERVAL_MS = 1_100;
const MB_MAX_RETRIES = 4;
const MB_MAX_BACKOFF_MS = 30_000;

let nextAllowedMusicBrainzRequestAt = 0;
let musicBrainzRequestQueue = Promise.resolve();

type MbRelation = {
  type?: string;
  "target-type": string;
  artist?: { id: string };
  release?: { id: string };
  "release-group"?: { id: string };
  work?: MbWork;
  url?: { resource: string };
};

type MbUrlEntityResponse = {
  relations?: MbRelation[];
};

type MbArtistResponse = {
  relations?: MbRelation[];
};

type MbSearchResponse = {
  artists?: {
    id?: string;
    name?: string;
    disambiguation?: string;
    score?: number;
  }[];
};

type MbReleaseGroup = {
  id: string;
  title?: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "artist-credit"?: {
    name: string;
    artist?: {
      id: string;
      name: string;
    };
  }[];
};

type MbReleaseGroupBrowseResponse = {
  "release-groups"?: MbReleaseGroup[];
  "release-group-count"?: number;
};

type MbReleaseSummary = {
  id: string;
  title?: string;
  date?: string;
  status?: string;
};

type MbReleaseBrowseResponse = {
  releases?: MbReleaseSummary[];
};

type MbArtistCredit = {
  name?: string;
  artist?: {
    id?: string;
    name?: string;
  };
};

type MbWork = {
  id?: string;
  relations?: MbRelation[];
};

type MbRecording = {
  id?: string;
  "artist-credit"?: MbArtistCredit[];
  relations?: MbRelation[];
};

type MbReleaseDetail = {
  id: string;
  title?: string;
  date?: string;
  status?: string;
  "artist-credit"?: MbArtistCredit[];
  media?: {
    tracks?: {
      recording?: MbRecording;
    }[];
  }[];
};

export type MbPlatformMapping = {
  provider: Provider;
  providerArtistId: string;
  url: string;
};

export type MbArtistSearchResult = {
  id: string;
  name: string;
  disambiguation: string | null;
  score: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMusicBrainzRequestSlot() {
  const waitForSlot = musicBrainzRequestQueue.then(async () => {
    const delayMs = Math.max(0, nextAllowedMusicBrainzRequestAt - Date.now());
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    nextAllowedMusicBrainzRequestAt = Date.now() + MB_MIN_REQUEST_INTERVAL_MS;
  });

  musicBrainzRequestQueue = waitForSlot.catch(() => undefined);
  await waitForSlot;
}

async function mbFetch(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    await waitForMusicBrainzRequestSlot();

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json();
    }

    const shouldRetry =
      response.status === 429 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;

    if (!shouldRetry || attempt >= MB_MAX_RETRIES) {
      throw new Error(`MusicBrainz request failed: ${response.status} ${url}`);
    }

    const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
    const backoffMs =
      retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, MB_MAX_BACKOFF_MS);
    await sleep(backoffMs);
  }
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
  const artists = await searchArtists(artistName, 1);

  return artists[0]?.id ?? null;
}

export async function searchArtists(query: string, limit = 10): Promise<MbArtistSearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const data = (await mbFetch(
    `${MB_API}/artist?query=${encodeURIComponent(query.trim())}&limit=${boundedLimit}&fmt=json`,
  )) as MbSearchResponse;

  return (data.artists ?? [])
    .filter((artist): artist is Required<Pick<NonNullable<MbSearchResponse["artists"]>[number], "id" | "name">> & NonNullable<MbSearchResponse["artists"]>[number] =>
      Boolean(artist.id && artist.name),
    )
    .map((artist) => ({
      id: artist.id,
      name: artist.name,
      disambiguation: artist.disambiguation ?? null,
      score: typeof artist.score === "number" ? artist.score : null,
    }));
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

export type MbArtistReleaseGroup = {
  releaseGroupId: string;
  title: string;
  firstReleaseDate: string;
  primaryType: string | null;
  secondaryTypes: string[];
  artistCredits: {
    name: string;
    artistId: string | null;
    artistName: string | null;
  }[];
};

function artistCreditIncludes(artistCredits: MbArtistCredit[] | undefined, mbid: string) {
  return Boolean(
    artistCredits?.some((credit) => credit.artist?.id === mbid),
  );
}

function releaseHasUsableRecordings(release: MbReleaseDetail) {
  return Boolean(
    release.media?.some((medium) =>
      medium.tracks?.some((track) => Boolean(track.recording?.id)),
    ),
  );
}

function relationCreditsArtist(relation: MbRelation, mbid: string) {
  return relation["target-type"] === "artist" && relation.artist?.id === mbid;
}

function classifyComposerAppearanceFromRelease(release: MbReleaseDetail, mbid: string) {
  let hasComposerRelationship = false;

  if (artistCreditIncludes(release["artist-credit"], mbid)) {
    return false;
  }

  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      const recording = track.recording;
      if (!recording) continue;

      if (artistCreditIncludes(recording["artist-credit"], mbid)) {
        return false;
      }

      for (const relation of recording.relations ?? []) {
        if (relationCreditsArtist(relation, mbid)) {
          return false;
        }

        if (relation["target-type"] !== "work" || !relation.work) {
          continue;
        }

        for (const workRelation of relation.work.relations ?? []) {
          if (!relationCreditsArtist(workRelation, mbid)) {
            continue;
          }

          if (workRelation.type === "composer") {
            hasComposerRelationship = true;
          } else {
            return false;
          }
        }
      }
    }
  }

  return hasComposerRelationship;
}

function releaseDateKey(release: MbReleaseSummary | MbReleaseDetail) {
  return release.date || "9999-99-99";
}

function representativeReleasePriority(release: MbReleaseSummary, firstReleaseDate: string) {
  const isOfficial = release.status?.toLowerCase() === "official";

  if (isOfficial && release.date === firstReleaseDate) {
    return 0;
  }

  if (isOfficial) {
    return 1;
  }

  return 2;
}

function sortRepresentativeCandidates(
  releases: MbReleaseSummary[],
  firstReleaseDate: string,
) {
  return [...releases].sort((left, right) => {
    const priorityDiff =
      representativeReleasePriority(left, firstReleaseDate) -
      representativeReleasePriority(right, firstReleaseDate);
    if (priorityDiff !== 0) return priorityDiff;

    const dateDiff = releaseDateKey(left).localeCompare(releaseDateKey(right));
    if (dateDiff !== 0) return dateDiff;

    return (left.title ?? "").localeCompare(right.title ?? "");
  });
}

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
 * Resolve a Deezer album to its canonical MusicBrainz release group.
 * This is used only when the normal title/date join cannot correlate the
 * Deezer enrichment row with a release group.
 */
export async function fetchMbReleaseGroupMbidByDeezerAlbumId(
  deezerAlbumId: string,
): Promise<string | null> {
  const deezerUrl = `https://www.deezer.com/album/${deezerAlbumId}`;

  try {
    const urlData = (await mbFetch(
      `${MB_API}/url?resource=${encodeURIComponent(deezerUrl)}&inc=release-group-rels&fmt=json`,
    )) as MbUrlEntityResponse;

    return (
      urlData.relations?.find(
        (relation) =>
          relation["target-type"] === "release_group" &&
          relation["release-group"]?.id,
      )?.["release-group"]?.id ?? null
    );
  } catch {
    return null;
  }
}

export async function fetchMbReleasePlatformMappingsByReleaseGroupMbid(
  releaseGroupMbid: string,
): Promise<MbReleasePlatformMapping[]> {
  try {
    const data = (await mbFetch(
      `${MB_API}/release-group/${releaseGroupMbid}?inc=url-rels&fmt=json`,
    )) as { relations?: MbRelation[] };

    const mappings: MbReleasePlatformMapping[] = [];
    for (const rel of data.relations ?? []) {
      if (rel["target-type"] !== "url" || !rel.url?.resource) continue;
      const mapping = parsePlatformReleaseUrl(rel.url.resource);
      if (mapping) mappings.push(mapping);
    }

    return mappings;
  } catch {
    return [];
  }
}

export async function fetchArtistReleaseGroupsByMbid(
  mbid: string,
): Promise<MbArtistReleaseGroup[]> {
  const releaseGroups: MbArtistReleaseGroup[] = [];
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const data = (await mbFetch(
      `${MB_API}/release-group?artist=${encodeURIComponent(mbid)}&limit=${limit}&offset=${offset}&fmt=json&release-group-status=website-default`,
    )) as MbReleaseGroupBrowseResponse;

    const page = (data["release-groups"] ?? [])
      .filter(
        (releaseGroup): releaseGroup is MbReleaseGroup & { title: string } =>
          Boolean(releaseGroup.id && releaseGroup.title && releaseGroup["first-release-date"]),
      )
      .map((releaseGroup) => ({
        releaseGroupId: releaseGroup.id,
        title: releaseGroup.title,
        firstReleaseDate: releaseGroup["first-release-date"]!,
        primaryType: releaseGroup["primary-type"] ?? null,
        secondaryTypes: releaseGroup["secondary-types"] ?? [],
        artistCredits: (releaseGroup["artist-credit"] ?? []).map((credit) => ({
          name: credit.name,
          artistId: credit.artist?.id ?? null,
          artistName: credit.artist?.name ?? null,
        })),
      }));

    releaseGroups.push(...page);
    total = Number(data["release-group-count"] ?? releaseGroups.length);
    offset += limit;

    if (page.length === 0) {
      break;
    }
  }

  return releaseGroups;
}

export async function isComposerOnlyAppearanceOnReleaseGroup(input: {
  releaseGroupMbid: string;
  firstReleaseDate: string;
  artistMbid: string;
}): Promise<boolean> {
  const data = (await mbFetch(
    `${MB_API}/release?release-group=${encodeURIComponent(input.releaseGroupMbid)}&inc=artist-credits&limit=100&fmt=json`,
  )) as MbReleaseBrowseResponse;

  const candidates = sortRepresentativeCandidates(
    (data.releases ?? []).filter((release): release is MbReleaseSummary & { id: string } =>
      Boolean(release.id),
    ),
    input.firstReleaseDate,
  );

  for (const candidate of candidates) {
    const release = (await mbFetch(
      `${MB_API}/release/${candidate.id}?inc=artist-credits+media+recordings+recording-level-rels+work-rels+work-level-rels+artist-rels&fmt=json`,
    )) as MbReleaseDetail;

    if (!releaseHasUsableRecordings(release)) {
      continue;
    }

    return classifyComposerAppearanceFromRelease(release, input.artistMbid);
  }

  return false;
}

/**
 * Fetch all known name aliases for an artist given their MusicBrainz ID.
 * Returns the raw alias strings (caller is responsible for normalization).
 */
export async function fetchArtistAliasesByMbid(mbid: string): Promise<string[]> {
  try {
    const data = (await mbFetch(
      `${MB_API}/artist/${mbid}?inc=aliases&fmt=json`,
    )) as { name?: string; aliases?: { name: string }[] };

    const names = new Set<string>();
    if (data.name) names.add(data.name);
    for (const alias of data.aliases ?? []) {
      if (alias.name) names.add(alias.name);
    }
    return [...names];
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
