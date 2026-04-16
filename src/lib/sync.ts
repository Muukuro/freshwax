import { JobKind, JobStatus, Provider, type Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import {
  fetchArtistReleases,
  fetchTrackArtistNames,
  fetchCurrentUserFollowedArtists,
  searchArtists,
} from "@/lib/providers/deezer";
import { fetchUserTopArtists } from "@/lib/providers/lastfm";
import {
  fetchMbPlatformMappingsByMbid,
  fetchMbReleasePlatformMappings,
  lookupMbidByUrl,
  searchArtistMbid,
} from "@/lib/providers/musicbrainz";
import {
  fetchWikidataPlatformMappingsByMbid,
} from "@/lib/providers/wikidata";
import { buildTidalReleaseSearchUrl, fetchTidalFollowedArtists } from "@/lib/providers/tidal";
import { classifyReleaseType } from "@/lib/release-types";
import { createSyncJobLog, updateSyncJobLog } from "@/lib/sync-job-log";
import { normalizeName } from "@/lib/utils";

type ArtistSearchResult = {
  catalogArtistId?: string;
  name: string;
  sourceProvider?: Provider;
  providerArtistId?: string | null;
  providerUrl?: string | null;
  imageUrl: string | null;
  deezerFans: number | null;
  raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

const CLASSICAL_GENRE_ID = 98;

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
  return releaseDate >= subDays(new Date(), maxDiscoveryWindowDays);
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
): Promise<string | null> {
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

  const existingArtistByName = mapping
    ? null
    : await prisma.artist.findFirst({
        where: {
          normalizedName,
        },
      });

  const artist =
    mapping?.artist ??
    existingArtistByName ??
    (await prisma.artist.create({
      data: {
        id: artistResult.catalogArtistId ?? undefined,
        canonicalName: artistResult.name,
        normalizedName,
        imageUrl: artistResult.imageUrl,
        deezerFans: artistResult.deezerFans,
      },
    }));

  if (existingArtistByName) {
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

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { discoveryWindowDays: true },
  });
  const discoveryCutoff = subDays(new Date(), settings?.discoveryWindowDays ?? 30);

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
      normalizedName: normalizedTarget,
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

  const exactMatch =
    results.find((result) => normalizeName(result.name) === normalizedTarget) ?? null;

  return exactMatch
    ? {
        name: exactMatch.name,
        sourceProvider: Provider.DEEZER,
        providerArtistId: exactMatch.providerArtistId,
        providerUrl: exactMatch.deezerUrl,
        imageUrl: exactMatch.imageUrl,
        deezerFans: exactMatch.deezerFans,
        raw: exactMatch.raw,
      }
    : null;
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

async function enrichReleasePlatformMappings(releaseId: string, deezerAlbumId: string) {
  const mbMappings = await fetchMbReleasePlatformMappings(deezerAlbumId).catch(() => []);
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
    if (!hasNonDeezerMappings) {
      const mbid = await resolveArtistMbid(artist.canonicalName, artist.mappings);

      if (mbid) {
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
    }

    // ── Step 2: Lazy Deezer discovery ───────────────────────────────────────
    // If no Deezer mapping exists yet (e.g. artist was imported from TIDAL or
    // Last.fm), try to find one by name so release sync can proceed.
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
      }
    }

    if (!deezerMapping) {
      await prisma.userFollow.updateMany({
        where: { artistId },
        data: { lastSyncedAt: new Date() },
      });
      await updateSyncJobLog(job, {
        status: JobStatus.SUCCEEDED,
        message: "No Deezer mapping found — release sync skipped",
      });
      return;
    }

    const remoteReleases = await fetchArtistReleases(deezerMapping.providerArtistId);
    const providerIds = remoteReleases.map((release) => release.providerReleaseId);
    const existingMappings = await prisma.releaseProviderMapping.findMany({
      where: {
        provider: Provider.DEEZER,
        providerReleaseId: { in: providerIds },
      },
      include: {
        release: {
          include: { mappings: true },
        },
      },
    });

    const mappingByProviderId = new Map(
      existingMappings.map((entry) => [entry.providerReleaseId, entry]),
    );
    const followerSettings = artist.followers.length
      ? await prisma.userSettings.findMany({
          where: {
            userId: {
              in: artist.followers.map((follow) => follow.userId),
            },
          },
          select: {
            userId: true,
            discoveryWindowDays: true,
          },
        })
      : [];
    const discoveryWindowByUserId = new Map(
      followerSettings.map((entry) => [entry.userId, entry.discoveryWindowDays]),
    );
    const maxDiscoveryWindowDays = Math.max(
      30,
      ...followerSettings.map((entry) => entry.discoveryWindowDays),
    );

    for (const release of remoteReleases) {
      const existing = mappingByProviderId.get(release.providerReleaseId);
      const tidalUrl = buildTidalReleaseSearchUrl(artist.canonicalName, release.title);
      const releaseDate = new Date(`${release.releaseDate}T00:00:00.000Z`);
      const type = classifyReleaseType(release.recordType, release.title);
      const rawSource = await enrichReleaseRawSource(release, maxDiscoveryWindowDays);

      if (existing) {
        await prisma.release.update({
          where: { id: existing.release.id },
          data: {
            title: release.title,
            normalizedTitle: normalizeName(release.title),
            releaseDate,
            type,
            coverUrl: release.coverUrl,
            deezerUrl: release.deezerUrl,
            tidalUrl,
            rawSource,
            lastSeenAt: new Date(),
          },
        });

        await prisma.releaseArtist.upsert({
          where: {
            releaseId_artistId: {
              releaseId: existing.release.id,
              artistId,
            },
          },
          update: {},
          create: {
            releaseId: existing.release.id,
            artistId,
          },
        });

        // Enrich platform links if we only have the Deezer mapping so far.
        const hasNonDeezerReleaseMappings = existing.release.mappings.some(
          (m) => m.provider !== Provider.DEEZER,
        );
        if (!hasNonDeezerReleaseMappings) {
          await enrichReleasePlatformMappings(existing.release.id, release.providerReleaseId);
        }

        continue;
      }

      const created = await prisma.release.create({
        data: {
          title: release.title,
          normalizedTitle: normalizeName(release.title),
          releaseDate,
          type,
          coverUrl: release.coverUrl,
          deezerUrl: release.deezerUrl,
          tidalUrl,
          rawSource,
          mappings: {
            create: {
              provider: Provider.DEEZER,
              providerReleaseId: release.providerReleaseId,
              url: release.deezerUrl,
              rawJson: release.raw,
            },
          },
          artists: {
            create: {
              artistId,
            },
          },
        },
      });

      await enrichReleasePlatformMappings(created.id, release.providerReleaseId);

      if (artist.followers.length > 0) {
        const eligibleFollowers = artist.followers.filter((follow) => {
          const windowDays = discoveryWindowByUserId.get(follow.userId) ?? 30;
          return releaseDate >= subDays(new Date(), windowDays);
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

        await prisma.notificationEvent.createMany({
          data: eligibleFollowers.map((follow) => ({
            userId: follow.userId,
            releaseId: created.id,
            kind: "release_discovered",
            payload: {
              artistId,
              provider: "deezer",
            },
          })),
          skipDuplicates: true,
        });
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
      message: `Synced ${remoteReleases.length} releases`,
    });
  } catch (error) {
    await updateSyncJobLog(job, {
      status: JobStatus.FAILED,
      message: error instanceof Error ? error.message : "Unknown sync failure",
    });
    throw error;
  }
}
