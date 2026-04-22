import { JobKind, JobStatus, Provider, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  fetchArtistById,
  fetchArtistReleases,
  fetchTrackArtistNames,
  fetchCurrentUserFollowedArtists,
  searchArtists,
} from "@/lib/providers/deezer";
import { fetchUserTopArtists } from "@/lib/providers/lastfm";
import {
  fetchArtistAliasesByMbid,
  fetchArtistReleaseGroupsByMbid,
  fetchMbPlatformMappingsByMbid,
  fetchMbReleasePlatformMappings,
  fetchMbReleasePlatformMappingsByReleaseGroupMbid,
  lookupMbidByUrl,
  searchArtistMbid,
} from "@/lib/providers/musicbrainz";
import {
  fetchWikidataPlatformMappingsByMbid,
} from "@/lib/providers/wikidata";
import {
  backfillReleaseDayNotificationsForFollow,
  createReleaseDayNotifications,
  createReleaseDiscoveredNotifications,
} from "@/lib/notifications";
import { buildTidalReleaseSearchUrl, fetchTidalFollowedArtists } from "@/lib/providers/tidal";
import { classifyReleaseType } from "@/lib/release-types";
import { createSyncJobLog, updateSyncJobLog } from "@/lib/sync-job-log";
import { getAppDefaultTimeZone, getEffectiveTimeZone } from "@/lib/timezone-server";
import { getDateOffsetUtcDateForTimeZone, getTodayUtcDateForTimeZone } from "@/lib/timezone";
import { normalizeName } from "@/lib/utils";

type ArtistSearchResult = {
  musicbrainzArtistId?: string;
  name: string;
  sourceProvider?: Provider;
  providerArtistId?: string | null;
  providerUrl?: string | null;
  imageUrl: string | null;
  deezerFans: number | null;
  raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

type CoreReleaseCandidate = {
  title: string;
  normalizedTitle: string;
  releaseDate: string;
  type: Prisma.ReleaseCreateInput["type"];
  coverUrl: string | null;
  deezerUrl: string | null;
  tidalUrl: string | null;
  confidence: number;
  rawSource: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  releaseGroupMbid?: string | null;
  deezerProviderReleaseId?: string | null;
  deezerRaw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

const CLASSICAL_GENRE_ID = 98;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getLegacyArtistMbid(artistId: string) {
  return UUID_PATTERN.test(artistId) ? artistId : null;
}

function getStoredArtistMbid(artist: { id: string; musicbrainzArtistId: string | null }) {
  return artist.musicbrainzArtistId ?? getLegacyArtistMbid(artist.id);
}

function shouldCaptureAttributionHints(
  release: { releaseDate: string; raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput },
  maxDiscoveryWindowDays: number,
) {
  if (!release.raw || typeof release.raw !== "object" || Array.isArray(release.raw)) {
    return false;
  }

  const genreId =
    "genre_id" in release.raw && typeof release.raw.genre_id === "number"
      ? release.raw.genre_id
      : null;

  if (genreId !== CLASSICAL_GENRE_ID) {
    return false;
  }

  const releaseDate = new Date(`${release.releaseDate}T00:00:00.000Z`);
  const discoveryCutoff = getDateOffsetUtcDateForTimeZone(
    getAppDefaultTimeZone(),
    -maxDiscoveryWindowDays,
  );

  return releaseDate >= discoveryCutoff;
}

async function enrichReleaseRawSource(
  release: { releaseDate: string; raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput },
  maxDiscoveryWindowDays: number,
) {
  if (!shouldCaptureAttributionHints(release, maxDiscoveryWindowDays)) {
    return release.raw;
  }

  if (!release.raw || typeof release.raw !== "object" || Array.isArray(release.raw)) {
    return release.raw;
  }

  const tracklistUrl =
    "tracklist" in release.raw && typeof release.raw.tracklist === "string"
      ? release.raw.tracklist
      : null;

  if (!tracklistUrl) {
    return release.raw;
  }

  try {
    const trackArtistNames = await fetchTrackArtistNames(tracklistUrl);

    return {
      ...release.raw,
      attributionHints: {
        trackArtistNames,
      },
    } satisfies Prisma.InputJsonValue;
  } catch (error) {
    console.error("Failed to enrich Deezer release attribution hints", error);
    return release.raw;
  }
}

function toInputJsonValue(
  value: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object" && "toJSON" in value && typeof value.toJSON === "function") {
    const normalized = value.toJSON();
    return normalized === null ? undefined : (normalized as Prisma.InputJsonValue);
  }

  return value as Prisma.InputJsonValue;
}

/**
 * Return the URL that MusicBrainz uses to identify an artist for a given provider.
 * MB stores canonical URLs per-provider; these must match what MB has indexed.
 */
function buildMbLookupUrl(provider: Provider, providerArtistId: string): string | null {
  switch (provider) {
    case Provider.DEEZER:
      return `https://www.deezer.com/artist/${providerArtistId}`;
    case Provider.TIDAL:
      // MB stores tidal.com URLs, not listen.tidal.com
      return `https://tidal.com/artist/${providerArtistId}`;
    case Provider.SPOTIFY:
      return `https://open.spotify.com/artist/${providerArtistId}`;
    default:
      return null;
  }
}

/**
 * Resolve a MusicBrainz artist ID from whatever provider mappings we already have,
 * falling back to a name search when no URL lookup succeeds.
 * Tries URL-based lookups first (unambiguous), then name search (best-effort).
 */
async function resolveArtistMbid(
  artistName: string,
  mappings: { provider: Provider; providerArtistId: string; url: string | null }[],
  storedMbid?: string | null,
): Promise<string | null> {
  if (storedMbid) {
    return storedMbid;
  }

  // Try each stored mapping — use the stored URL if present, otherwise build the canonical MB URL.
  for (const mapping of mappings) {
    const url = mapping.url ?? buildMbLookupUrl(mapping.provider, mapping.providerArtistId);
    if (!url) continue;
    try {
      const mbid = await lookupMbidByUrl(url);
      if (mbid) return mbid;
    } catch {
      // try next mapping
    }
  }

  // Fall back to name search — less precise but works when no provider URL matches.
  try {
    return await searchArtistMbid(artistName);
  } catch {
    return null;
  }
}

function mapMusicBrainzReleaseType(
  primaryType: string | null,
  secondaryTypes: string[],
): Prisma.ReleaseCreateInput["type"] {
  const normalizedPrimaryType = primaryType?.toLowerCase() ?? "";
  const normalizedSecondaryTypes = secondaryTypes.map((type) => type.toLowerCase());

  if (normalizedSecondaryTypes.includes("live")) return "LIVE";
  if (normalizedSecondaryTypes.includes("compilation")) return "COMPILATION";
  if (normalizedSecondaryTypes.includes("remix") || normalizedSecondaryTypes.includes("dj-mix")) {
    return "COMPILATION";
  }

  switch (normalizedPrimaryType) {
    case "album":
      return "ALBUM";
    case "single":
      return "SINGLE";
    case "ep":
      return "EP";
    default:
      return "UNKNOWN";
  }
}

async function buildCoreReleaseCandidates(
  artistName: string,
  mbid: string,
  deezerMapping: { providerArtistId: string } | null,
  maxDiscoveryWindowDays: number,
) {
  const mbReleaseGroups = await fetchArtistReleaseGroupsByMbid(mbid);
  const releaseByKey = new Map<string, CoreReleaseCandidate>();

  for (const releaseGroup of mbReleaseGroups) {
    const normalizedTitle = normalizeName(releaseGroup.title);
    if (!normalizedTitle) continue;

    const key = `${normalizedTitle}:${releaseGroup.firstReleaseDate}`;
    releaseByKey.set(key, {
      title: releaseGroup.title,
      normalizedTitle,
      releaseDate: releaseGroup.firstReleaseDate,
      type: mapMusicBrainzReleaseType(releaseGroup.primaryType, releaseGroup.secondaryTypes),
      coverUrl: null,
      deezerUrl: null,
      tidalUrl: buildTidalReleaseSearchUrl(artistName, releaseGroup.title),
      confidence: 0.7,
      rawSource: {
        source: "musicbrainz",
        releaseGroupId: releaseGroup.releaseGroupId,
        primaryType: releaseGroup.primaryType,
        secondaryTypes: releaseGroup.secondaryTypes,
      } satisfies Prisma.InputJsonValue,
      releaseGroupMbid: releaseGroup.releaseGroupId,
      deezerProviderReleaseId: null,
      deezerRaw: undefined,
    });
  }

  if (!deezerMapping) {
    return [...releaseByKey.values()];
  }

  const deezerReleases = await fetchArtistReleases(deezerMapping.providerArtistId).catch(() => []);
  for (const release of deezerReleases) {
    const normalizedTitle = normalizeName(release.title);
    if (!normalizedTitle) continue;

    const key = `${normalizedTitle}:${release.releaseDate}`;
    const existing = releaseByKey.get(key);
    const rawSource = await enrichReleaseRawSource(release, maxDiscoveryWindowDays);
    const deezerRaw = toInputJsonValue(rawSource ?? release.raw);

    if (existing) {
      releaseByKey.set(key, {
        ...existing,
        coverUrl: release.coverUrl ?? existing.coverUrl,
        deezerUrl: release.deezerUrl,
        tidalUrl: buildTidalReleaseSearchUrl(artistName, release.title),
        confidence: Math.max(existing.confidence, 0.95),
        rawSource: deezerRaw
          ? ({
              ...(typeof existing.rawSource === "object" &&
              existing.rawSource &&
              !Array.isArray(existing.rawSource)
                ? existing.rawSource
                : {}),
              deezer: deezerRaw,
            } satisfies Prisma.InputJsonValue)
          : existing.rawSource,
        deezerProviderReleaseId: release.providerReleaseId,
        deezerRaw: release.raw,
      });
      continue;
    }

    releaseByKey.set(key, {
      title: release.title,
      normalizedTitle,
      releaseDate: release.releaseDate,
      type: classifyReleaseType(release.recordType, release.title),
      coverUrl: release.coverUrl,
      deezerUrl: release.deezerUrl,
      tidalUrl: buildTidalReleaseSearchUrl(artistName, release.title),
      confidence: 0.6,
      rawSource: deezerRaw
        ? ({
            source: "deezer-enrichment",
            deezer: deezerRaw,
          } satisfies Prisma.InputJsonValue)
        : ({
            source: "deezer-enrichment",
          } satisfies Prisma.InputJsonValue),
      releaseGroupMbid: null,
      deezerProviderReleaseId: release.providerReleaseId,
      deezerRaw: release.raw,
    });
  }

  return [...releaseByKey.values()];
}

export async function followArtistForUser(userId: string, artistResult: ArtistSearchResult) {
  const normalizedName = normalizeName(artistResult.name);
  if (!normalizedName) {
    throw new Error("Artist name could not be normalized");
  }

  const mapping =
    artistResult.sourceProvider && artistResult.providerArtistId
      ? await prisma.artistProviderMapping.findUnique({
          where: {
            provider_providerArtistId: {
              provider: artistResult.sourceProvider,
              providerArtistId: artistResult.providerArtistId,
            },
          },
          include: {
            artist: true,
          },
        })
      : null;

  const existingArtistByMusicBrainzId = artistResult.musicbrainzArtistId
    ? await prisma.artist.findFirst({
        where: {
          OR: [
            { musicbrainzArtistId: artistResult.musicbrainzArtistId },
            { id: artistResult.musicbrainzArtistId },
          ],
        },
      })
    : null;

  const existingArtistByName = mapping || existingArtistByMusicBrainzId
    ? null
    : await prisma.artist.findFirst({
        where: {
          OR: [
            { normalizedName },
            { normalizedAliases: { has: normalizedName } },
          ],
        },
      });

  const artist =
    existingArtistByMusicBrainzId ??
    mapping?.artist ??
    existingArtistByName ??
    (await prisma.artist.create({
      data: {
        musicbrainzArtistId: artistResult.musicbrainzArtistId,
        canonicalName: artistResult.name,
        normalizedName,
        imageUrl: artistResult.imageUrl,
        deezerFans: artistResult.deezerFans,
      },
    }));

  if (mapping?.artist || existingArtistByMusicBrainzId || existingArtistByName) {
    await prisma.artist.update({
      where: { id: artist.id },
      data: {
        musicbrainzArtistId:
          artist.musicbrainzArtistId ?? artistResult.musicbrainzArtistId ?? undefined,
        canonicalName: artistResult.name,
        normalizedName,
        imageUrl: artistResult.imageUrl ?? artist.imageUrl,
        deezerFans: artistResult.deezerFans ?? artist.deezerFans,
      },
    });
  }

  if (artistResult.sourceProvider && artistResult.providerArtistId) {
    await prisma.artistProviderMapping.upsert({
      where: {
        provider_providerArtistId: {
          provider: artistResult.sourceProvider,
          providerArtistId: artistResult.providerArtistId,
        },
      },
      update: {
        artistId: artist.id,
        url: artistResult.providerUrl,
        rawJson: artistResult.raw ?? undefined,
      },
      create: {
        artistId: artist.id,
        provider: artistResult.sourceProvider,
        providerArtistId: artistResult.providerArtistId,
        url: artistResult.providerUrl,
        rawJson: artistResult.raw ?? undefined,
      },
    });
  }

  await prisma.userFollow.upsert({
    where: {
      userId_artistId: {
        userId,
        artistId: artist.id,
      },
    },
    update: {},
    create: {
      userId,
      artistId: artist.id,
    },
  });

  const [settings, user] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId },
      select: { discoveryWindowDays: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const discoveryCutoff = getDateOffsetUtcDateForTimeZone(
    timeZone,
    -(settings?.discoveryWindowDays ?? 30),
  );

  const existingReleases = await prisma.release.findMany({
    where: {
      releaseDate: {
        gte: discoveryCutoff,
      },
      artists: {
        some: {
          artistId: artist.id,
        },
      },
    },
    select: { id: true },
  });

  if (existingReleases.length > 0) {
    await prisma.discoveryEvent.createMany({
      data: existingReleases.map((release) => ({
        userId,
        releaseId: release.id,
        artistId: artist.id,
        reason: "artist_followed",
      })),
      skipDuplicates: true,
    });
  }

  await backfillReleaseDayNotificationsForFollow(userId, artist.id, timeZone);

  return artist;
}

export async function unfollowArtistForUser(userId: string, artistId: string) {
  await prisma.userFollow.delete({
    where: {
      userId_artistId: {
        userId,
        artistId,
      },
    },
  });
}

export async function importDeezerFollowedArtistsForUser(userId: string, accessToken: string) {
  const artists = await fetchCurrentUserFollowedArtists(accessToken);

  for (const artist of artists) {
    const followedArtist = await followArtistForUser(userId, {
      name: artist.name,
      sourceProvider: Provider.DEEZER,
      providerArtistId: artist.providerArtistId,
      providerUrl: artist.deezerUrl,
      imageUrl: artist.imageUrl,
      deezerFans: artist.deezerFans,
      raw: artist.raw,
    });
    await enqueueArtistSyncSafe(followedArtist.id);
  }

  return {
    importedCount: artists.length,
  };
}

async function resolveArtistSearchResultByName(name: string) {
  const normalizedTarget = normalizeName(name);
  if (!normalizedTarget) return null;

  const existingArtist = await prisma.artist.findFirst({
    where: {
      OR: [
        { normalizedName: normalizedTarget },
        { normalizedAliases: { has: normalizedTarget } },
      ],
      mappings: {
        some: {
          provider: Provider.DEEZER,
        },
      },
    },
    include: {
      mappings: {
        where: {
          provider: Provider.DEEZER,
        },
        take: 1,
      },
    },
  });

  const existingMapping = existingArtist?.mappings[0];
  if (existingArtist && existingMapping) {
    return {
      providerArtistId: existingMapping.providerArtistId,
      name: existingArtist.canonicalName,
      sourceProvider: Provider.DEEZER,
      providerUrl: existingMapping.url,
      imageUrl: existingArtist.imageUrl,
      deezerFans: existingArtist.deezerFans,
      raw: existingMapping.rawJson ?? undefined,
    };
  }

  const results = await searchArtists(name);
  if (results.length === 0) return null;

  // Prefer an exact normalized-name match (catches number-word variants after normalization).
  const exactMatch = results.find((result) => normalizeName(result.name) === normalizedTarget);
  if (exactMatch) {
    return {
      name: exactMatch.name,
      sourceProvider: Provider.DEEZER,
      providerArtistId: exactMatch.providerArtistId,
      providerUrl: exactMatch.deezerUrl,
      imageUrl: exactMatch.imageUrl,
      deezerFans: exactMatch.deezerFans,
      raw: exactMatch.raw,
    };
  }

  // Fall back: if a top result's Deezer ID is already mapped to any artist in our DB,
  // that provider mapping is the authoritative link regardless of name divergence.
  // This handles cases where Deezer's canonical name differs from what we stored
  // (e.g. we have "Thirty Seconds To Mars" but Deezer stores "30 Seconds To Mars").
  const resultIds = results.slice(0, 5).map((r) => r.providerArtistId);
  const knownMapping = await prisma.artistProviderMapping.findFirst({
    where: {
      provider: Provider.DEEZER,
      providerArtistId: { in: resultIds },
    },
  });
  if (knownMapping) {
    const matched = results.find((r) => r.providerArtistId === knownMapping.providerArtistId)!;
    return {
      name: matched.name,
      sourceProvider: Provider.DEEZER,
      providerArtistId: matched.providerArtistId,
      providerUrl: matched.deezerUrl,
      imageUrl: matched.imageUrl,
      deezerFans: matched.deezerFans,
      raw: matched.raw,
    };
  }

  return null;
}

export async function importLastfmTopArtistsForUser(
  userId: string,
  username: string,
  minimumPlaycount: number,
) {
  const artists = await fetchUserTopArtists(username, minimumPlaycount);
  const uniqueArtists = artists.filter((artist, index, entries) => {
    const normalizedName = normalizeName(artist.name);
    if (!normalizedName) return false;

    return entries.findIndex((entry) => normalizeName(entry.name) === normalizedName) === index;
  });
  let importedCount = 0;
  let skippedCount = 0;

  for (const artist of uniqueArtists) {
    const normalizedName = normalizeName(artist.name);
    if (!normalizedName) {
      skippedCount += 1;
      continue;
    }

    // Follow the artist by name — no Deezer resolution required at import time.
    // Release sync will lazily discover the Deezer mapping on the first sync run.
    const followedArtist = await followArtistForUser(userId, {
      name: artist.name,
      imageUrl: null,
      deezerFans: null,
    });
    await enqueueArtistSyncSafe(followedArtist.id);
    importedCount += 1;
  }

  return {
    importedCount,
    skippedCount,
    inspectedCount: uniqueArtists.length,
  };
}

export async function importTidalFollowedArtistsForUser(userId: string, accessToken: string) {
  const artists = await fetchTidalFollowedArtists(accessToken);
  const uniqueArtists = artists.filter((artist, index, entries) => {
    const normalizedName = normalizeName(artist.name);
    if (!normalizedName) return false;

    return entries.findIndex((entry) => normalizeName(entry.name) === normalizedName) === index;
  });
  let importedCount = 0;
  let skippedCount = 0;

  for (const artist of uniqueArtists) {
    if (!normalizeName(artist.name)) {
      skippedCount += 1;
      continue;
    }

    // Follow the artist directly using the TIDAL provider data — no Deezer resolution
    // required at import time. Release sync will lazily discover the Deezer mapping.
    const followedArtist = await followArtistForUser(userId, {
      name: artist.name,
      sourceProvider: Provider.TIDAL,
      providerArtistId: artist.providerArtistId,
      providerUrl: artist.tidalUrl,
      imageUrl: null,
      deezerFans: null,
    });

    await enqueueArtistSyncSafe(followedArtist.id);
    importedCount += 1;
  }

  return {
    importedCount,
    skippedCount,
    inspectedCount: uniqueArtists.length,
  };
}

export async function syncAllArtists() {
  const artistIds = await prisma.userFollow.findMany({
    select: { artistId: true },
    distinct: ["artistId"],
  });

  for (const entry of artistIds) {
    await syncArtist(entry.artistId);
  }
}

async function enrichReleasePlatformMappings(
  releaseId: string,
  input: { deezerAlbumId?: string | null; releaseGroupMbid?: string | null },
) {
  const mbMappings = input.releaseGroupMbid
    ? await fetchMbReleasePlatformMappingsByReleaseGroupMbid(input.releaseGroupMbid).catch(() => [])
    : input.deezerAlbumId
      ? await fetchMbReleasePlatformMappings(input.deezerAlbumId).catch(() => [])
      : [];

  for (const mapping of mbMappings) {
    await prisma.releaseProviderMapping.upsert({
      where: {
        provider_providerReleaseId: {
          provider: mapping.provider,
          providerReleaseId: mapping.providerReleaseId,
        },
      },
      update: { releaseId, url: mapping.url },
      create: {
        releaseId,
        provider: mapping.provider,
        providerReleaseId: mapping.providerReleaseId,
        url: mapping.url,
      },
    });
  }
}

async function enqueueArtistSyncSafe(artistId: string) {
  const { enqueueArtistSync } = await import("@/lib/queue");
  await enqueueArtistSync(artistId);
}

export async function syncArtist(artistId: string, userId?: string) {
  const job = await createSyncJobLog({
    kind: JobKind.SYNC_FOLLOWED_ARTIST,
    artistId,
    userId,
    message: "Worker started an artist sync",
  });

  try {
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        mappings: true,
        followers: true,
      },
    });

    if (!artist) {
      throw new Error("Artist not found");
    }

    // ── Step 1: Platform link enrichment ────────────────────────────────────
    // Run on first sync only (once non-Deezer mappings exist we consider it done).
    // Resolves MBID from whatever provider data is available, then queries
    // Wikidata (structured IDs) and MusicBrainz (YouTube Music, gaps).
    const hasNonDeezerMappings = artist.mappings.some((m) => m.provider !== Provider.DEEZER);
    const mbid = await resolveArtistMbid(
      artist.canonicalName,
      artist.mappings,
      getStoredArtistMbid(artist),
    );

    if (mbid && artist.musicbrainzArtistId !== mbid) {
      await prisma.artist.update({
        where: { id: artistId },
        data: { musicbrainzArtistId: mbid },
      });
      artist.musicbrainzArtistId = mbid;
    }

    if (mbid && artist.normalizedAliases.length === 0) {
      const rawAliases = await fetchArtistAliasesByMbid(mbid);
      const normalizedAliases = [
        ...new Set(rawAliases.map(normalizeName).filter(Boolean)),
      ];
      await prisma.artist.update({
        where: { id: artistId },
        data: { normalizedAliases },
      });
      artist.normalizedAliases = normalizedAliases;
    }

    if (!hasNonDeezerMappings && mbid) {
      const wdResult = await fetchWikidataPlatformMappingsByMbid(mbid);
      const enrichedMappings = [...(wdResult?.mappings ?? [])];

      // MusicBrainz supplements Wikidata for providers it doesn't cover (e.g. YouTube Music).
      const mbMappings = await fetchMbPlatformMappingsByMbid(mbid);
      const coveredProviders = new Set(enrichedMappings.map((m) => m.provider));
      for (const mbMapping of mbMappings) {
        if (!coveredProviders.has(mbMapping.provider) && mbMapping.provider !== Provider.DEEZER) {
          enrichedMappings.push(mbMapping);
        }
      }

      const existingProviders = new Set(artist.mappings.map((m) => m.provider));
      for (const mapping of enrichedMappings) {
        if (existingProviders.has(mapping.provider)) continue;
        await prisma.artistProviderMapping.upsert({
          where: {
            provider_providerArtistId: {
              provider: mapping.provider,
              providerArtistId: mapping.providerArtistId,
            },
          },
          update: { artistId, url: mapping.url },
          create: {
            artistId,
            provider: mapping.provider,
            providerArtistId: mapping.providerArtistId,
            url: mapping.url,
          },
        });
      }
    }

    // ── Step 2: Canonical release discovery ─────────────────────────────────
    // Resolve a credential-free release feed via MusicBrainz. Deezer remains
    // optional enrichment and must not gate sync.
    if (!mbid) {
      await prisma.userFollow.updateMany({
        where: { artistId },
        data: { lastSyncedAt: new Date() },
      });
      await updateSyncJobLog(job, {
        status: JobStatus.SUCCEEDED,
        message: "No canonical MusicBrainz match found — release sync skipped",
      });
      return;
    }

    // ── Step 3: Optional platform enrichment ────────────────────────────────
    // Resolve artist mappings best-effort, but never require them for core sync.
    let deezerMapping = artist.mappings.find((entry) => entry.provider === Provider.DEEZER);
    if (!deezerMapping) {
      const deezerMatch = await resolveArtistSearchResultByName(artist.canonicalName);
      if (deezerMatch) {
        const upserted = await prisma.artistProviderMapping.upsert({
          where: {
            provider_providerArtistId: {
              provider: Provider.DEEZER,
              providerArtistId: deezerMatch.providerArtistId,
            },
          },
          update: { artistId, url: deezerMatch.providerUrl },
          create: {
            artistId,
            provider: Provider.DEEZER,
            providerArtistId: deezerMatch.providerArtistId,
            url: deezerMatch.providerUrl,
            rawJson: deezerMatch.raw ?? undefined,
          },
        });
        deezerMapping = upserted;

        if (!artist.imageUrl && deezerMatch.imageUrl) {
          await prisma.artist.update({
            where: { id: artistId },
            data: {
              imageUrl: deezerMatch.imageUrl,
              deezerFans: deezerMatch.deezerFans ?? undefined,
            },
          });
          artist.imageUrl = deezerMatch.imageUrl;
        }
      }
    } else if (!artist.imageUrl) {
      const deezerArtist = await fetchArtistById(deezerMapping.providerArtistId).catch(() => null);
      if (deezerArtist?.imageUrl) {
        await prisma.artist.update({
          where: { id: artistId },
          data: {
            imageUrl: deezerArtist.imageUrl,
            deezerFans: deezerArtist.deezerFans ?? undefined,
          },
        });
        artist.imageUrl = deezerArtist.imageUrl;
      }
    }
    const followerUsers = artist.followers.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: artist.followers.map((follow) => follow.userId),
            },
          },
          select: {
            id: true,
            timezone: true,
            settings: {
              select: {
                discoveryWindowDays: true,
              },
            },
          },
        })
      : [];
    const discoveryWindowByUserId = new Map(
      followerUsers.map((entry) => [entry.id, entry.settings?.discoveryWindowDays ?? 30]),
    );
    const timezoneByUserId = new Map(
      followerUsers.map((entry) => [entry.id, getEffectiveTimeZone(entry.timezone)]),
    );
    const maxDiscoveryWindowDays = Math.max(
      30,
      ...followerUsers.map((entry) => entry.settings?.discoveryWindowDays ?? 30),
    );
    const today = getTodayUtcDateForTimeZone(getAppDefaultTimeZone());

    const remoteReleases = await buildCoreReleaseCandidates(
      artist.canonicalName,
      mbid,
      deezerMapping
        ? {
            providerArtistId: deezerMapping.providerArtistId,
          }
        : null,
      maxDiscoveryWindowDays,
    );

    for (const release of remoteReleases) {
      const releaseDate = new Date(`${release.releaseDate}T00:00:00.000Z`);
      const existingMapping = release.deezerProviderReleaseId
        ? await prisma.releaseProviderMapping.findUnique({
            where: {
              provider_providerReleaseId: {
                provider: Provider.DEEZER,
                providerReleaseId: release.deezerProviderReleaseId,
              },
            },
            include: {
              release: {
                include: { mappings: true },
              },
            },
          })
        : null;
      const existingByCoreShape = existingMapping
        ? null
        : await prisma.release.findFirst({
            where: {
              normalizedTitle: release.normalizedTitle,
              releaseDate,
              artists: {
                some: {
                  artistId,
                },
              },
            },
            include: { mappings: true },
          });
      const existingRelease = existingMapping?.release ?? existingByCoreShape;

      if (existingRelease) {
        await prisma.release.update({
          where: { id: existingRelease.id },
          data: {
            title: release.title,
            normalizedTitle: release.normalizedTitle,
            releaseDate,
            type: release.type,
            coverUrl: release.coverUrl,
            deezerUrl: release.deezerUrl,
            tidalUrl: release.tidalUrl,
            confidence: release.confidence,
            rawSource: release.rawSource,
            lastSeenAt: new Date(),
          },
        });

        await prisma.releaseArtist.upsert({
          where: {
            releaseId_artistId: {
              releaseId: existingRelease.id,
              artistId,
            },
          },
          update: {},
          create: {
            releaseId: existingRelease.id,
            artistId,
          },
        });

        if (release.deezerProviderReleaseId) {
          await prisma.releaseProviderMapping.upsert({
            where: {
              provider_providerReleaseId: {
                provider: Provider.DEEZER,
                providerReleaseId: release.deezerProviderReleaseId,
              },
            },
            update: {
              releaseId: existingRelease.id,
              url: release.deezerUrl,
              rawJson: release.deezerRaw ?? undefined,
            },
            create: {
              releaseId: existingRelease.id,
              provider: Provider.DEEZER,
              providerReleaseId: release.deezerProviderReleaseId,
              url: release.deezerUrl,
              rawJson: release.deezerRaw ?? undefined,
            },
          });
        }

        const hasExactReleaseMappings = existingRelease.mappings.some(
          (mapping) => mapping.provider !== Provider.DEEZER,
        );
        if (!hasExactReleaseMappings) {
          await enrichReleasePlatformMappings(existingRelease.id, {
            deezerAlbumId: release.deezerProviderReleaseId,
            releaseGroupMbid: release.releaseGroupMbid,
          });
        }

        if (releaseDate >= today) {
          await createReleaseDayNotifications(
            artist.followers.map((follow) => ({
              userId: follow.userId,
              timezone: timezoneByUserId.get(follow.userId) ?? getAppDefaultTimeZone(),
            })),
            existingRelease.id,
            releaseDate,
            artistId,
          );
        }

        continue;
      }

      const created = await prisma.release.create({
        data: {
          title: release.title,
          normalizedTitle: release.normalizedTitle,
          releaseDate,
          type: release.type,
          coverUrl: release.coverUrl,
          deezerUrl: release.deezerUrl,
          tidalUrl: release.tidalUrl,
          confidence: release.confidence,
          rawSource: release.rawSource,
          mappings: release.deezerProviderReleaseId
            ? {
                create: {
                  provider: Provider.DEEZER,
                  providerReleaseId: release.deezerProviderReleaseId,
                  url: release.deezerUrl,
                  rawJson: release.deezerRaw ?? undefined,
                },
              }
            : undefined,
          artists: {
            create: {
              artistId,
            },
          },
        },
      });

      await enrichReleasePlatformMappings(created.id, {
        deezerAlbumId: release.deezerProviderReleaseId,
        releaseGroupMbid: release.releaseGroupMbid,
      });

      if (artist.followers.length > 0) {
        const eligibleFollowers = artist.followers.filter((follow) => {
          const windowDays = discoveryWindowByUserId.get(follow.userId) ?? 30;
          const followerTimeZone = timezoneByUserId.get(follow.userId) ?? getAppDefaultTimeZone();
          const discoveryCutoff = getDateOffsetUtcDateForTimeZone(followerTimeZone, -windowDays);
          return releaseDate >= discoveryCutoff;
        });

        if (eligibleFollowers.length === 0) {
          continue;
        }

        await prisma.discoveryEvent.createMany({
          data: eligibleFollowers.map((follow) => ({
            userId: follow.userId,
            releaseId: created.id,
            artistId,
            reason: "provider_sync",
          })),
          skipDuplicates: true,
        });

        await createReleaseDiscoveredNotifications(eligibleFollowers, created.id, artistId, {
          artistId,
          provider: release.deezerProviderReleaseId ? "deezer" : "musicbrainz",
        } satisfies Prisma.InputJsonValue);
      }

      if (releaseDate >= today) {
        await createReleaseDayNotifications(
          artist.followers.map((follow) => ({
            userId: follow.userId,
              timezone: timezoneByUserId.get(follow.userId) ?? getAppDefaultTimeZone(),
          })),
          created.id,
          releaseDate,
          artistId,
        );
      }
    }

    await prisma.userFollow.updateMany({
      where: { artistId },
      data: {
        lastSyncedAt: new Date(),
      },
    });

    await updateSyncJobLog(job, {
      status: JobStatus.SUCCEEDED,
      message: `Synced ${remoteReleases.length} releases from credential-free core sources`,
    });
  } catch (error) {
    await updateSyncJobLog(job, {
      status: JobStatus.FAILED,
      message: error instanceof Error ? error.message : "Unknown sync failure",
    });
    throw error;
  }
}
