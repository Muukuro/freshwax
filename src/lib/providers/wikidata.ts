import { Provider } from "@prisma/client";

const WD_API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "freshwax/1.0 (self-hosted music release tracker)";

// Wikidata property IDs
const P_SPOTIFY = "P1902";
const P_TIDAL = "P4576";
const P_APPLE_MUSIC = "P2850"; // iTunes/Apple Music numeric artist ID
const P_MUSICBRAINZ = "P434";
const P_DEEZER = "P2722";
const P_OCCUPATION = "P106";
const P_FIELD_OF_WORK = "P101";
const P_GENRE = "P136";
const Q_COMPOSER = "Q36834";
const Q_CLASSICAL_MUSIC = "Q9730";

export type WdPlatformResult = {
  mappings: {
    provider: Provider;
    providerArtistId: string;
    url: string;
  }[];
  musicBrainzId: string | null;
};

export type WdArtistProfile = {
  wikidataEntityId: string;
  isClassicalComposer: boolean;
};

async function wdFetch(params: Record<string, string>): Promise<unknown> {
  const url = new URL(WD_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Wikidata request failed: ${response.status}`);
  }

  return response.json();
}

function claimString(claims: Record<string, unknown[]>, property: string): string | null {
  const entries = claims[property];
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const first = entries[0] as Record<string, unknown>;
  const mainsnak = first["mainsnak"] as Record<string, unknown> | undefined;
  const datavalue = mainsnak?.["datavalue"] as Record<string, unknown> | undefined;
  const value = datavalue?.["value"];

  return typeof value === "string" ? value : null;
}

function claimEntityIds(claims: Record<string, unknown[]>, property: string) {
  const entries = claims[property];
  if (!Array.isArray(entries) || entries.length === 0) return [];

  return entries.flatMap((entry) => {
    const claim = entry as Record<string, unknown>;
    const mainsnak = claim["mainsnak"] as Record<string, unknown> | undefined;
    const datavalue = mainsnak?.["datavalue"] as Record<string, unknown> | undefined;
    const value = datavalue?.["value"] as Record<string, unknown> | undefined;
    const numericId = value?.["numeric-id"];

    return typeof numericId === "number" ? [`Q${numericId}`] : [];
  });
}

async function findEntityByStatement(property: string, value: string): Promise<string | null> {
  const data = (await wdFetch({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:${property}=${value}`,
    srnamespace: "0",
    srlimit: "1",
  })) as { query?: { search?: { title: string }[] } };

  return data?.query?.search?.[0]?.title ?? null;
}

async function getEntityClaims(qid: string): Promise<Record<string, unknown[]>> {
  const data = (await wdFetch({
    action: "wbgetentities",
    ids: qid,
    props: "claims",
  })) as { entities?: Record<string, { claims: Record<string, unknown[]> }> };

  return data?.entities?.[qid]?.claims ?? {};
}

function claimsToResult(claims: Record<string, unknown[]>): WdPlatformResult {
  const mappings: WdPlatformResult["mappings"] = [];

  const spotifyId = claimString(claims, P_SPOTIFY);
  if (spotifyId) {
    mappings.push({
      provider: Provider.SPOTIFY,
      providerArtistId: spotifyId,
      url: `https://open.spotify.com/artist/${spotifyId}`,
    });
  }

  const tidalId = claimString(claims, P_TIDAL);
  if (tidalId) {
    mappings.push({
      provider: Provider.TIDAL,
      providerArtistId: tidalId,
      url: `https://listen.tidal.com/artist/${tidalId}`,
    });
  }

  const appleMusicId = claimString(claims, P_APPLE_MUSIC);
  if (appleMusicId) {
    mappings.push({
      provider: Provider.APPLE_MUSIC,
      providerArtistId: appleMusicId,
      url: `https://music.apple.com/us/artist/${appleMusicId}`,
    });
  }

  return {
    mappings,
    musicBrainzId: claimString(claims, P_MUSICBRAINZ),
  };
}

function claimsToArtistProfile(qid: string, claims: Record<string, unknown[]>): WdArtistProfile {
  const occupations = new Set(claimEntityIds(claims, P_OCCUPATION));
  const fieldsOfWork = new Set(claimEntityIds(claims, P_FIELD_OF_WORK));
  const genres = new Set(claimEntityIds(claims, P_GENRE));

  return {
    wikidataEntityId: qid,
    isClassicalComposer:
      occupations.has(Q_COMPOSER) &&
      (fieldsOfWork.has(Q_CLASSICAL_MUSIC) || genres.has(Q_CLASSICAL_MUSIC)),
  };
}

/**
 * Look up streaming platform IDs using a MusicBrainz artist ID (the most
 * reliable cross-reference). Returns null on any lookup failure.
 */
export async function fetchWikidataPlatformMappingsByMbid(
  mbid: string,
): Promise<WdPlatformResult | null> {
  let qid: string | null;
  try {
    qid = await findEntityByStatement(P_MUSICBRAINZ, mbid);
  } catch {
    return null;
  }

  if (!qid) return null;

  let claims: Record<string, unknown[]>;
  try {
    claims = await getEntityClaims(qid);
  } catch {
    return null;
  }

  return claimsToResult(claims);
}

/**
 * Look up coarse artist classification data using a MusicBrainz artist ID.
 * This is intentionally conservative: an artist is treated as a classical
 * composer only when Wikidata has composer occupation plus a classical
 * field-of-work or genre statement.
 */
export async function fetchWikidataArtistProfileByMbid(
  mbid: string,
): Promise<WdArtistProfile | null> {
  let qid: string | null;
  try {
    qid = await findEntityByStatement(P_MUSICBRAINZ, mbid);
  } catch {
    return null;
  }

  if (!qid) return null;

  let claims: Record<string, unknown[]>;
  try {
    claims = await getEntityClaims(qid);
  } catch {
    return null;
  }

  return claimsToArtistProfile(qid, claims);
}

/**
 * Look up streaming platform IDs using a Deezer artist ID.
 * Use this when no MBID is available yet.
 * Returns null on any lookup failure.
 */
export async function fetchWikidataPlatformMappingsByDeezerArtistId(
  deezerArtistId: string,
): Promise<WdPlatformResult | null> {
  let qid: string | null;
  try {
    qid = await findEntityByStatement(P_DEEZER, deezerArtistId);
  } catch {
    return null;
  }

  if (!qid) return null;

  let claims: Record<string, unknown[]>;
  try {
    claims = await getEntityClaims(qid);
  } catch {
    return null;
  }

  return claimsToResult(claims);
}
