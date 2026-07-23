import {
  JobKind,
  JobStatus,
  Provider,
  ProviderMappingSource,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  clearImportCancellation,
  isArtistSyncCancellationRequested,
  isImportCancellationRequested,
} from "@/lib/queue";
import {
  fetchArtistById,
  fetchArtistReleases,
  fetchCurrentUserFollowedArtists,
} from "@/lib/providers/deezer";
import { fetchUserTopArtists } from "@/lib/providers/lastfm";
import {
  fetchArtistAliasesByMbid,
  fetchArtistReleaseGroupsByMbid,
  fetchMbPlatformMappingsByMbid,
  fetchMbReleaseGroupMbidByDeezerAlbumId,
  fetchMbReleasePlatformMappings,
  fetchMbReleasePlatformMappingsByReleaseGroupMbid,
  isComposerOnlyAppearanceOnReleaseGroup,
  lookupMbidByUrl,
  searchArtistMbid,
} from "@/lib/providers/musicbrainz";
import {
  fetchWikidataArtistProfileByMbid,
  fetchWikidataPlatformMappingsByMbid,
} from "@/lib/providers/wikidata";
import {
  backfillReleaseDayNotificationsForFollow,
  createReleaseDayNotifications,
  createReleaseDiscoveredNotifications,
} from "@/lib/notifications";
import { buildTidalReleaseSearchUrl, fetchTidalFollowedArtists } from "@/lib/providers/tidal";
import { classifyReleaseType } from "@/lib/release-types";
import { RELEASE_ARTIST_ROLE } from "@/lib/release-artist-role";
import { createSyncJobLog, updateSyncJobLog } from "@/lib/sync-job-log";
import { getAppDefaultTimeZone, getEffectiveTimeZone } from "@/lib/timezone-server";
import { getDateOffsetUtcDateForTimeZone, getTodayUtcDateForTimeZone } from "@/lib/timezone";
import { normalizeName } from "@/lib/utils";
import {
  getLegacyReleaseGroupMbid,
  mergeDuplicateReleases,
  selectReleaseIdentityMatch,
} from "@/lib/release-duplicates";

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

type ReleaseArtistRoleCandidate = {
  releaseGroupMbid?: string | null;
  releaseDate: string;
  title: string;
};

type SyncWindow = {
  releaseDateCutoff: Date;
  releaseDateCutoffKey: string;
};

async function upsertAutomaticArtistProviderMapping(input: {
  artistId: string;
  provider: Provider;
  providerArtistId: string;
  url: string | null;
  rawJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}) {
  const manualForArtistProvider = await prisma.artistProviderMapping.findFirst({
    where: {
      artistId: input.artistId,
      provider: input.provider,
      source: ProviderMappingSource.MANUAL,
    },
    select: { id: true },
  });

  if (manualForArtistProvider) {
    return;
  }

  const existing = await prisma.artistProviderMapping.findUnique({
    where: {
      provider_providerArtistId: {
        provider: input.provider,
        providerArtistId: input.providerArtistId,
      },
    },
    select: { id: true, source: true, manuallyCorrectedAt: true },
  });

  if (existing?.source === ProviderMappingSource.MANUAL || existing?.manuallyCorrectedAt) {
    return;
  }

  await prisma.artistProviderMapping.deleteMany({
    where: {
      artistId: input.artistId,
      provider: input.provider,
      providerArtistId: { not: input.providerArtistId },
      source: { not: ProviderMappingSource.MANUAL },
    },
  });

  await prisma.artistProviderMapping.upsert({
    where: {
      provider_providerArtistId: {
        provider: input.provider,
        providerArtistId: input.providerArtistId,
      },
    },
    update: {
      artistId: input.artistId,
      url: input.url,
      rawJson: input.rawJson ?? undefined,
      source: ProviderMappingSource.AUTOMATIC,
    },
    create: {
      artistId: input.artistId,
      provider: input.provider,
      providerArtistId: input.providerArtistId,
      url: input.url,
      rawJson: input.rawJson ?? undefined,
      source: ProviderMappingSource.AUTOMATIC,
    },
  });
}

async function upsertAutomaticReleaseProviderMapping(input: {
  releaseId: string;
  provider: Provider;
  providerReleaseId: string;
  url: string | null;
  rawJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}) {
  const manualForReleaseProvider = await prisma.releaseProviderMapping.findFirst({
    where: {
      releaseId: input.releaseId,
      provider: input.provider,
      source: ProviderMappingSource.MANUAL,
    },
    select: { id: true },
  });

  if (manualForReleaseProvider) {
    return;
  }

  const existing = await prisma.releaseProviderMapping.findUnique({
    where: {
      provider_providerReleaseId: {
        provider: input.provider,
        providerReleaseId: input.providerReleaseId,
      },
    },
    select: { id: true, source: true, manuallyCorrectedAt: true },
  });

  if (existing?.source === ProviderMappingSource.MANUAL || existing?.manuallyCorrectedAt) {
    return;
  }

  await prisma.releaseProviderMapping.deleteMany({
    where: {
      releaseId: input.releaseId,
      provider: input.provider,
      providerReleaseId: { not: input.providerReleaseId },
      source: { not: ProviderMappingSource.MANUAL },
    },
  });

  await prisma.releaseProviderMapping.upsert({
    where: {
      provider_providerReleaseId: {
        provider: input.provider,
        providerReleaseId: input.providerReleaseId,
      },
    },
    update: {
      releaseId: input.releaseId,
      url: input.url,
      rawJson: input.rawJson ?? undefined,
      source: ProviderMappingSource.AUTOMATIC,
    },
    create: {
      releaseId: input.releaseId,
      provider: input.provider,
      providerReleaseId: input.providerReleaseId,
      url: input.url,
      rawJson: input.rawJson ?? undefined,
      source: ProviderMappingSource.AUTOMATIC,
    },
  });
}

export class SyncCancellationError extends Error {
  constructor(message = "Sync cancelled by operator") {
    super(message);
    this.name = "SyncCancellationError";
  }
}

export class ImportCancellationError extends Error {
  constructor(message = "Import cancelled by operator") {
    super(message);
    this.name = "ImportCancellationError";
  }
}

async function throwIfSyncCancelled(queueJobId?: string) {
  if (!queueJobId) {
    return;
  }

  if (await isArtistSyncCancellationRequested(queueJobId)) {
    throw new SyncCancellationError();
  }
}

async function throwIfImportCancelled(userId: string) {
  if (await isImportCancellationRequested(userId)) {
    throw new ImportCancellationError();
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

function buildMbLookupUrl(provider: Provider, providerArtistId: string): string | null {
  switch (provider) {
    case Provider.TIDAL:
      // MB stores tidal.com URLs, not listen.tidal.com
      return `https://tidal.com/artist/${providerArtistId}`;
    case Provider.SPOTIFY:
      return `https://open.spotify.com/artist/${providerArtistId}`;
    default:
      return null;
  }
}

async function resolveCanonicalMusicbrainzArtistId(input: {
  musicbrainzArtistId?: string | null;
  name: string;
  sourceProvider?: Provider;
  providerArtistId?: string | null;
  providerUrl?: string | null;
}) {
  if (input.musicbrainzArtistId) {
    return input.musicbrainzArtistId;
  }

  const lookupUrl =
    (input.sourceProvider && input.sourceProvider !== Provider.DEEZER && input.providerUrl) ??
    (input.sourceProvider &&
    input.sourceProvider !== Provider.DEEZER &&
    input.providerArtistId
      ? buildMbLookupUrl(input.sourceProvider, input.providerArtistId)
      : null);

  if (lookupUrl) {
    try {
      const mbid = await lookupMbidByUrl(lookupUrl);
      if (mbid) {
        return mbid;
      }
    } catch {
      // fall through to name search
    }
  }

  try {
    return await searchArtistMbid(input.name);
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

function toUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSyncWindow(maxDiscoveryWindowDays: number): SyncWindow {
  const releaseDateCutoff = getDateOffsetUtcDateForTimeZone(
    getAppDefaultTimeZone(),
    -maxDiscoveryWindowDays,
  );

  return {
    releaseDateCutoff,
    releaseDateCutoffKey: toUtcDateKey(releaseDateCutoff),
  };
}

function isReleaseInsideSyncWindow(releaseDate: string, window: SyncWindow) {
  return releaseDate >= window.releaseDateCutoffKey;
}

async function resolveReleaseArtistRole(input: {
  artistMbid: string;
  artistName: string;
  isClassicalComposer: boolean;
  release: ReleaseArtistRoleCandidate;
}) {
  if (!input.isClassicalComposer || !input.release.releaseGroupMbid) {
    return RELEASE_ARTIST_ROLE.PRIMARY;
  }

  try {
    const isComposerAppearance = await isComposerOnlyAppearanceOnReleaseGroup({
      releaseGroupMbid: input.release.releaseGroupMbid,
      firstReleaseDate: input.release.releaseDate,
      artistMbid: input.artistMbid,
    });

    return isComposerAppearance
      ? RELEASE_ARTIST_ROLE.COMPOSER_APPEARANCE
      : RELEASE_ARTIST_ROLE.PRIMARY;
  } catch (error) {
    console.error("Failed to classify MusicBrainz composer appearance", {
      artistName: input.artistName,
      artistMbid: input.artistMbid,
      releaseTitle: input.release.title,
      releaseGroupMbid: input.release.releaseGroupMbid,
      error,
    });
    return RELEASE_ARTIST_ROLE.PRIMARY;
  }
}

async function buildCoreReleaseCandidates(
  artistName: string,
  mbid: string,
  deezerMapping: { providerArtistId: string } | null,
  syncWindow: SyncWindow,
  queueJobId?: string,
) {
  const mbReleaseGroups = await fetchArtistReleaseGroupsByMbid(mbid);
  const releaseByKey = new Map<string, CoreReleaseCandidate>();
  const releaseByMbid = new Map<string, CoreReleaseCandidate>();

  for (const releaseGroup of mbReleaseGroups) {
    await throwIfSyncCancelled(queueJobId);
    if (!isReleaseInsideSyncWindow(releaseGroup.firstReleaseDate, syncWindow)) {
      continue;
    }

    const normalizedTitle = normalizeName(releaseGroup.title);
    if (!normalizedTitle) continue;

    const key = `${normalizedTitle}:${releaseGroup.firstReleaseDate}`;
    const candidate = {
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
        artistCredits: releaseGroup.artistCredits,
      } satisfies Prisma.InputJsonValue,
      releaseGroupMbid: releaseGroup.releaseGroupId,
      deezerProviderReleaseId: null,
      deezerRaw: undefined,
    } satisfies CoreReleaseCandidate;
    releaseByKey.set(key, candidate);
    releaseByMbid.set(releaseGroup.releaseGroupId, candidate);
  }

  if (!deezerMapping) {
    return [...releaseByKey.values()];
  }

  const deezerReleases = await fetchArtistReleases(deezerMapping.providerArtistId).catch(() => []);
  for (const release of deezerReleases) {
    await throwIfSyncCancelled(queueJobId);
    if (!isReleaseInsideSyncWindow(release.releaseDate, syncWindow)) {
      continue;
    }

    const normalizedTitle = normalizeName(release.title);
    if (!normalizedTitle) continue;

    const key = `${normalizedTitle}:${release.releaseDate}`;
    let existing = releaseByKey.get(key);
    let releaseGroupMbid = existing?.releaseGroupMbid ?? null;

    if (!existing) {
      releaseGroupMbid =
        await fetchMbReleaseGroupMbidByDeezerAlbumId(
          release.providerReleaseId,
        );
      existing = releaseGroupMbid
        ? releaseByMbid.get(releaseGroupMbid)
        : undefined;
    }
    const deezerRaw = toInputJsonValue(release.raw);

    if (existing) {
      const enriched = {
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
      } satisfies CoreReleaseCandidate;
      const existingKey = `${existing.normalizedTitle}:${existing.releaseDate}`;
      releaseByKey.set(existingKey, enriched);
      if (enriched.releaseGroupMbid) {
        releaseByMbid.set(enriched.releaseGroupMbid, enriched);
      }
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
      releaseGroupMbid,
      deezerProviderReleaseId: release.providerReleaseId,
      deezerRaw: release.raw,
    });
  }

  return [...releaseByKey.values()];
}

export async function followArtistForUser(userId: string, artistResult: ArtistSearchResult) {
  if (!artistResult.musicbrainzArtistId) {
    throw new Error("Artist must resolve to a canonical MusicBrainz identity before following");
  }

  const normalizedName = normalizeName(artistResult.name);
  if (!normalizedName) {
    throw new Error("Artist name could not be normalized");
  }

  const existingArtistByMusicBrainzId = await prisma.artist.findUnique({
    where: {
      musicbrainzArtistId: artistResult.musicbrainzArtistId,
    },
  });

  const artist =
    existingArtistByMusicBrainzId ??
    (await prisma.artist.create({
      data: {
        musicbrainzArtistId: artistResult.musicbrainzArtistId,
        canonicalName: artistResult.name,
        normalizedName,
        normalizedAliases: [],
        imageUrl: artistResult.imageUrl,
        deezerFans: artistResult.deezerFans,
      },
    }));

  if (existingArtistByMusicBrainzId) {
    await prisma.artist.update({
      where: { id: artist.id },
      data: {
        canonicalName: artistResult.name,
        normalizedName,
        imageUrl: artistResult.imageUrl ?? artist.imageUrl,
        deezerFans: artistResult.deezerFans ?? artist.deezerFans,
      },
    });
  }

  if (artistResult.sourceProvider && artistResult.providerArtistId) {
    await upsertAutomaticArtistProviderMapping({
      artistId: artist.id,
      provider: artistResult.sourceProvider,
      providerArtistId: artistResult.providerArtistId,
      url: artistResult.providerUrl ?? null,
      rawJson: artistResult.raw,
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
  try {
    await clearImportCancellation(userId);
    const artists = await fetchCurrentUserFollowedArtists(accessToken);
    let importedCount = 0;
    let skippedCount = 0;

    for (const artist of artists) {
      await throwIfImportCancelled(userId);
      const musicbrainzArtistId = await resolveCanonicalMusicbrainzArtistId({
        name: artist.name,
        sourceProvider: Provider.DEEZER,
        providerArtistId: artist.providerArtistId,
        providerUrl: artist.deezerUrl,
      });

      if (!musicbrainzArtistId) {
        skippedCount += 1;
        continue;
      }

      const followedArtist = await followArtistForUser(userId, {
        musicbrainzArtistId,
        name: artist.name,
        sourceProvider: Provider.DEEZER,
        providerArtistId: artist.providerArtistId,
        providerUrl: artist.deezerUrl,
        imageUrl: artist.imageUrl,
        deezerFans: artist.deezerFans,
        raw: artist.raw,
      });
      await enqueueArtistSyncSafe(followedArtist.id);
      importedCount += 1;
    }

    return {
      importedCount,
      skippedCount,
      inspectedCount: artists.length,
    };
  } finally {
    await clearImportCancellation(userId);
  }
}

export async function importLastfmTopArtistsForUser(
  userId: string,
  username: string,
  minimumPlaycount: number,
) {
  try {
    await clearImportCancellation(userId);
    const artists = await fetchUserTopArtists(username, minimumPlaycount);
    const uniqueArtists = artists.filter((artist, index, entries) => {
      const normalizedName = normalizeName(artist.name);
      if (!normalizedName) return false;

      return entries.findIndex((entry) => normalizeName(entry.name) === normalizedName) === index;
    });
    let importedCount = 0;
    let skippedCount = 0;

    for (const artist of uniqueArtists) {
      await throwIfImportCancelled(userId);
      const normalizedName = normalizeName(artist.name);
      if (!normalizedName) {
        skippedCount += 1;
        continue;
      }

      const musicbrainzArtistId = await resolveCanonicalMusicbrainzArtistId({
        musicbrainzArtistId: artist.mbid,
        name: artist.name,
      });

      if (!musicbrainzArtistId) {
        skippedCount += 1;
        continue;
      }

      const followedArtist = await followArtistForUser(userId, {
        musicbrainzArtistId,
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
  } finally {
    await clearImportCancellation(userId);
  }
}

export async function importTidalFollowedArtistsForUser(userId: string, accessToken: string) {
  try {
    await clearImportCancellation(userId);
    const artists = await fetchTidalFollowedArtists(accessToken);
    const uniqueArtists = artists.filter((artist, index, entries) => {
      const normalizedName = normalizeName(artist.name);
      if (!normalizedName) return false;

      return entries.findIndex((entry) => normalizeName(entry.name) === normalizedName) === index;
    });
    let importedCount = 0;
    let skippedCount = 0;

    for (const artist of uniqueArtists) {
      await throwIfImportCancelled(userId);
      if (!normalizeName(artist.name)) {
        skippedCount += 1;
        continue;
      }

      const musicbrainzArtistId = await resolveCanonicalMusicbrainzArtistId({
        name: artist.name,
        sourceProvider: Provider.TIDAL,
        providerArtistId: artist.providerArtistId,
        providerUrl: artist.tidalUrl,
      });

      if (!musicbrainzArtistId) {
        skippedCount += 1;
        continue;
      }

      const followedArtist = await followArtistForUser(userId, {
        musicbrainzArtistId,
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
  } finally {
    await clearImportCancellation(userId);
  }
}

export async function syncAllArtists(queueJobId?: string) {
  const artistIds = await prisma.userFollow.findMany({
    select: { artistId: true },
    distinct: ["artistId"],
  });

  for (const entry of artistIds) {
    await throwIfSyncCancelled(queueJobId);
    await syncArtist(entry.artistId, undefined, queueJobId);
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
    await upsertAutomaticReleaseProviderMapping({
      releaseId,
      provider: mapping.provider,
      providerReleaseId: mapping.providerReleaseId,
      url: mapping.url,
    });
  }
}

function buildReleaseCoreKey(normalizedTitle: string, releaseDate: Date) {
  return `${normalizedTitle}:${toUtcDateKey(releaseDate)}`;
}

async function enqueueArtistSyncSafe(artistId: string) {
  const { enqueueArtistSync } = await import("@/lib/queue");
  await enqueueArtistSync(artistId);
}

export async function syncArtist(artistId: string, userId?: string, queueJobId?: string) {
  const job = await createSyncJobLog({
    kind: JobKind.SYNC_FOLLOWED_ARTIST,
    artistId,
    userId,
    message: "Worker started an artist sync",
  });

  try {
    await throwIfSyncCancelled(queueJobId);
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
    const mbid = artist.musicbrainzArtistId;

    if (artist.normalizedAliases.length === 0) {
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

    const wdResult = await fetchWikidataPlatformMappingsByMbid(mbid);
    const wdProfile = await fetchWikidataArtistProfileByMbid(mbid);
    if (wdProfile) {
      await prisma.artist.update({
        where: { id: artistId },
        data: {
          wikidataEntityId: wdProfile.wikidataEntityId,
          isClassicalComposer: wdProfile.isClassicalComposer,
        },
      });
      artist.wikidataEntityId = wdProfile.wikidataEntityId;
      artist.isClassicalComposer = wdProfile.isClassicalComposer;
    }
    const enrichedMappings = [...(wdResult?.mappings ?? [])];

    // MusicBrainz supplements Wikidata for providers it doesn't cover and is also
    // the canonical source for Deezer enrichment mappings.
    const mbMappings = await fetchMbPlatformMappingsByMbid(mbid);
    const coveredProviderIds = new Set(
      enrichedMappings.map((mapping) => `${mapping.provider}:${mapping.providerArtistId}`),
    );
    for (const mbMapping of mbMappings) {
      const key = `${mbMapping.provider}:${mbMapping.providerArtistId}`;
      if (!coveredProviderIds.has(key)) {
        enrichedMappings.push(mbMapping);
        coveredProviderIds.add(key);
      }
    }

    for (const mapping of enrichedMappings) {
      await throwIfSyncCancelled(queueJobId);
      await upsertAutomaticArtistProviderMapping({
        artistId,
        provider: mapping.provider,
        providerArtistId: mapping.providerArtistId,
        url: mapping.url,
      });
    }

    // ── Step 2: Canonical release discovery ─────────────────────────────────
    // Resolve a credential-free release feed via MusicBrainz. Deezer remains
    // optional enrichment and must not gate sync.
    // ── Step 3: Optional platform enrichment ────────────────────────────────
    // Resolve artist mappings best-effort from canonical MB/Wikidata sources only.
    // Deezer remains optional public enrichment and is used only when we already
    // have a canonical Deezer mapping.
    let deezerMapping = artist.mappings.find((entry) => entry.provider === Provider.DEEZER);
    if (!deezerMapping) {
      const storedDeezerMapping = await prisma.artistProviderMapping.findFirst({
        where: {
          artistId,
          provider: Provider.DEEZER,
        },
      });
      if (storedDeezerMapping) {
        deezerMapping = storedDeezerMapping;
      }
    }

    if (deezerMapping && !artist.imageUrl) {
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
    const syncWindow = buildSyncWindow(maxDiscoveryWindowDays);
    const today = getTodayUtcDateForTimeZone(getAppDefaultTimeZone());

    const remoteReleases = await buildCoreReleaseCandidates(
      artist.canonicalName,
      mbid,
      deezerMapping
        ? {
            providerArtistId: deezerMapping.providerArtistId,
          }
        : null,
      syncWindow,
      queueJobId,
    );

    const deezerReleaseIds = remoteReleases
      .flatMap((release) => (release.deezerProviderReleaseId ? [release.deezerProviderReleaseId] : []));
    const releaseGroupMbids = remoteReleases.flatMap((release) =>
      release.releaseGroupMbid ? [release.releaseGroupMbid] : [],
    );
    const candidateTitles = [...new Set(remoteReleases.map((release) => release.normalizedTitle))];
    const [existingMappings, existingReleasesByShape, existingReleasesByMbid] = await Promise.all([
      deezerReleaseIds.length > 0
        ? prisma.releaseProviderMapping.findMany({
            where: {
              provider: Provider.DEEZER,
              source: { not: ProviderMappingSource.MANUAL },
              manuallyCorrectedAt: null,
              providerReleaseId: {
                in: deezerReleaseIds,
              },
            },
            include: {
              release: {
                include: { mappings: true },
              },
            },
          })
        : Promise.resolve([]),
      candidateTitles.length > 0
        ? prisma.release.findMany({
            where: {
              normalizedTitle: {
                in: candidateTitles,
              },
              releaseDate: {
                gte: syncWindow.releaseDateCutoff,
              },
              artists: {
                some: {
                  artistId,
                },
              },
            },
            include: { mappings: true },
          })
        : Promise.resolve([]),
      releaseGroupMbids.length > 0
        ? prisma.release.findMany({
            where: {
              releaseGroupMbid: { in: releaseGroupMbids },
            },
            include: { mappings: true },
          })
        : Promise.resolve([]),
    ]);
    const existingMappingByDeezerId = new Map(
      existingMappings.map((mapping) => [mapping.providerReleaseId, mapping]),
    );
    const existingReleaseByCoreKey = new Map(
      existingReleasesByShape.map((release) => [
        buildReleaseCoreKey(release.normalizedTitle, release.releaseDate),
        release,
      ]),
    );
    const existingReleaseByMbid = new Map(
      existingReleasesByMbid.map((release) => [
        release.releaseGroupMbid!,
        release,
      ]),
    );
    for (const release of existingReleasesByShape) {
      const legacyMbid = getLegacyReleaseGroupMbid(release.rawSource);
      if (legacyMbid && !existingReleaseByMbid.has(legacyMbid)) {
        existingReleaseByMbid.set(legacyMbid, release);
      }
    }

    for (const release of remoteReleases) {
      await throwIfSyncCancelled(queueJobId);
      const releaseDate = new Date(`${release.releaseDate}T00:00:00.000Z`);
      const existingMapping = release.deezerProviderReleaseId
        ? existingMappingByDeezerId.get(release.deezerProviderReleaseId) ?? null
        : null;
      const existingByMbid = release.releaseGroupMbid
        ? existingReleaseByMbid.get(release.releaseGroupMbid) ?? null
        : null;
      const shapeCandidate =
        existingReleaseByCoreKey.get(
          buildReleaseCoreKey(release.normalizedTitle, releaseDate),
        ) ?? null;
      const existingByCoreShape =
        existingMapping || existingByMbid
          ? null
          : shapeCandidate &&
              (!release.releaseGroupMbid ||
                !shapeCandidate.releaseGroupMbid ||
                shapeCandidate.releaseGroupMbid === release.releaseGroupMbid)
            ? shapeCandidate
            : null;
      let existingRelease = selectReleaseIdentityMatch({
        incomingReleaseGroupMbid: release.releaseGroupMbid,
        byMusicBrainz: existingByMbid,
        byProvider: existingMapping?.release ?? null,
        byShape: existingByCoreShape,
      });

      if (
        existingByMbid &&
        existingMapping &&
        existingByMbid.id !== existingMapping.release.id
      ) {
        await mergeDuplicateReleases({
          survivingReleaseId: existingByMbid.id,
          duplicateReleaseId: existingMapping.release.id,
        });
        existingRelease = existingByMbid;
        existingMappingByDeezerId.set(release.deezerProviderReleaseId!, {
          ...existingMapping,
          releaseId: existingByMbid.id,
          release: existingByMbid,
        });
      }
      const shouldEnrichPlatformMappings = releaseDate >= syncWindow.releaseDateCutoff;
      const releaseArtistRole = await resolveReleaseArtistRole({
        artistMbid: mbid,
        artistName: artist.canonicalName,
        isClassicalComposer: artist.isClassicalComposer,
        release,
      });

      if (existingRelease) {
        await prisma.release.update({
          where: { id: existingRelease.id },
          data: {
            title: release.title,
            releaseGroupMbid: release.releaseGroupMbid ?? undefined,
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
          update: {
            role: releaseArtistRole,
          },
          create: {
            releaseId: existingRelease.id,
            artistId,
            role: releaseArtistRole,
          },
        });

        if (release.deezerProviderReleaseId) {
          await upsertAutomaticReleaseProviderMapping({
            releaseId: existingRelease.id,
            provider: Provider.DEEZER,
            providerReleaseId: release.deezerProviderReleaseId,
            url: release.deezerUrl,
            rawJson: release.deezerRaw,
          });
        }

        const hasExactReleaseMappings = existingRelease.mappings.some(
          (mapping) => mapping.provider !== Provider.DEEZER,
        );
        if (!hasExactReleaseMappings && shouldEnrichPlatformMappings) {
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
          releaseGroupMbid: release.releaseGroupMbid,
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
              role: releaseArtistRole,
            },
          },
        },
      });

      if (shouldEnrichPlatformMappings) {
        await enrichReleasePlatformMappings(created.id, {
          deezerAlbumId: release.deezerProviderReleaseId,
          releaseGroupMbid: release.releaseGroupMbid,
        });
      }

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
      message: `Synced ${remoteReleases.length} recent or upcoming releases from core sources`,
    });
  } catch (error) {
    await updateSyncJobLog(job, {
      status: JobStatus.FAILED,
      message: error instanceof Error ? error.message : "Unknown sync failure",
    });
    throw error;
  }
}
