import { JobKind, JobStatus, Provider, type Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import {
  fetchArtistReleases,
  fetchCurrentUserFollowedArtists,
  searchArtists,
} from "@/lib/providers/deezer";
import { fetchUserTopArtists } from "@/lib/providers/lastfm";
import { buildTidalReleaseSearchUrl } from "@/lib/providers/tidal";
import { classifyReleaseType } from "@/lib/release-types";
import { normalizeName } from "@/lib/utils";

type ArtistSearchResult = {
  providerArtistId: string;
  name: string;
  deezerUrl: string | null;
  imageUrl: string | null;
  deezerFans: number | null;
  raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export async function followArtistForUser(userId: string, artistResult: ArtistSearchResult) {
  const mapping = await prisma.artistProviderMapping.findUnique({
    where: {
      provider_providerArtistId: {
        provider: Provider.DEEZER,
        providerArtistId: artistResult.providerArtistId,
      },
    },
    include: {
      artist: true,
    },
  });

  const artist =
    mapping?.artist ??
    (await prisma.artist.create({
      data: {
        canonicalName: artistResult.name,
        normalizedName: normalizeName(artistResult.name),
        imageUrl: artistResult.imageUrl,
        deezerFans: artistResult.deezerFans,
        mappings: {
          create: {
            provider: Provider.DEEZER,
            providerArtistId: artistResult.providerArtistId,
            url: artistResult.deezerUrl,
            rawJson: artistResult.raw,
          },
        },
      },
    }));

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
    const followedArtist = await followArtistForUser(userId, artist);
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
      deezerUrl: existingMapping.url,
      imageUrl: existingArtist.imageUrl,
      deezerFans: existingArtist.deezerFans,
      raw: existingMapping.rawJson ?? undefined,
    };
  }

  const results = await searchArtists(name);
  if (results.length === 0) return null;

  const exactMatch =
    results.find((result) => normalizeName(result.name) === normalizedTarget) ?? null;

  return exactMatch;
}

export async function importLastfmTopArtistsForUser(userId: string, username: string) {
  const artists = await fetchUserTopArtists(username, 50);
  const uniqueArtists = artists.filter((artist, index, entries) => {
    const normalizedName = normalizeName(artist.name);
    if (!normalizedName) return false;

    return entries.findIndex((entry) => normalizeName(entry.name) === normalizedName) === index;
  });
  let importedCount = 0;
  let skippedCount = 0;

  for (const artist of uniqueArtists) {
    const match = await resolveArtistSearchResultByName(artist.name);

    if (!match) {
      skippedCount += 1;
      continue;
    }

    const followedArtist = await followArtistForUser(userId, match);
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

async function enqueueArtistSyncSafe(artistId: string) {
  const { enqueueArtistSync } = await import("@/lib/queue");
  await enqueueArtistSync(artistId);
}

export async function syncArtist(artistId: string, userId?: string) {
  const job = await prisma.syncJob.create({
    data: {
      kind: JobKind.SYNC_FOLLOWED_ARTIST,
      status: JobStatus.RUNNING,
      artistId,
      userId,
      startedAt: new Date(),
    },
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

    const deezerMapping = artist.mappings.find((entry) => entry.provider === Provider.DEEZER);
    if (!deezerMapping) {
      throw new Error("Artist is missing a Deezer mapping");
    }

    const remoteReleases = await fetchArtistReleases(deezerMapping.providerArtistId);
    const providerIds = remoteReleases.map((release) => release.providerReleaseId);
    const existingMappings = await prisma.releaseProviderMapping.findMany({
      where: {
        provider: Provider.DEEZER,
        providerReleaseId: { in: providerIds },
      },
      include: {
        release: true,
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

    for (const release of remoteReleases) {
      const existing = mappingByProviderId.get(release.providerReleaseId);
      const tidalUrl = buildTidalReleaseSearchUrl(artist.canonicalName, release.title);
      const releaseDate = new Date(`${release.releaseDate}T00:00:00.000Z`);
      const type = classifyReleaseType(release.recordType, release.title);

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
            rawSource: release.raw,
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
          rawSource: release.raw,
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

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.SUCCEEDED,
        finishedAt: new Date(),
        message: `Synced ${remoteReleases.length} releases`,
      },
    });
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : "Unknown sync failure",
      },
    });
    throw error;
  }
}
