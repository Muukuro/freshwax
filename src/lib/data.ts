import { ReleaseType, type Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
import {
  buildArtistPlatformLinks,
  buildReleasePlatformLinks,
  type PlatformLinkEntry,
} from "@/lib/platform-links";
import { horizonDate } from "@/lib/utils";

export function buildReleaseTypeFilter(settings: {
  includeSingles: boolean;
  includeEps: boolean;
  includeCompilations: boolean;
  includeLive: boolean;
  includeReissues: boolean;
}) {
  const excludedTypes: ReleaseType[] = [];

  if (!settings.includeSingles) excludedTypes.push(ReleaseType.SINGLE);
  if (!settings.includeEps) excludedTypes.push(ReleaseType.EP);
  if (!settings.includeCompilations) excludedTypes.push(ReleaseType.COMPILATION);
  if (!settings.includeLive) excludedTypes.push(ReleaseType.LIVE);
  if (!settings.includeReissues) {
    excludedTypes.push(ReleaseType.REISSUE, ReleaseType.REMASTER);
  }

  return excludedTypes.length ? { notIn: excludedTypes } : undefined;
}

const CLASSICAL_GENRE_ID = 98;

type ReleaseWithArtists = {
  title: string;
  rawSource: Prisma.JsonValue | null;
  artists: { artist: { canonicalName: string } }[];
  discoveries?: { discoveredAt: Date }[];
};

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function extractTrackArtistNames(rawSource: Prisma.JsonValue | null) {
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
    return [];
  }

  const attributionHints =
    "attributionHints" in rawSource &&
    rawSource.attributionHints &&
    typeof rawSource.attributionHints === "object" &&
    !Array.isArray(rawSource.attributionHints)
      ? rawSource.attributionHints
      : null;

  if (!attributionHints || !("trackArtistNames" in attributionHints)) {
    return [];
  }

  const trackArtistNames = attributionHints.trackArtistNames;
  if (!Array.isArray(trackArtistNames)) {
    return [];
  }

  return trackArtistNames.filter((value): value is string => typeof value === "string");
}

function isClassicalGenre(rawSource: Prisma.JsonValue | null) {
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
    return false;
  }

  return "genre_id" in rawSource && rawSource.genre_id === CLASSICAL_GENRE_ID;
}

export function filterReleasesForSettings<T extends ReleaseWithArtists>(
  releases: T[],
  settings: {
    hideClassicalComposerAppearances?: boolean;
  },
) {
  if (!settings.hideClassicalComposerAppearances) {
    return releases;
  }

  return releases.filter((release) => {
    if (!isClassicalGenre(release.rawSource)) {
      return true;
    }

    const trackArtistNames = extractTrackArtistNames(release.rawSource);
    if (trackArtistNames.length === 0) {
      return true;
    }

    const linkedArtistNames = normalizedSet(
      release.artists.map((entry) => entry.artist.canonicalName),
    );

    if (linkedArtistNames.size === 0) {
      return true;
    }

    return trackArtistNames.some((name) => linkedArtistNames.has(name.trim().toLowerCase()));
  });
}

function releaseInclude(userId: string) {
  return {
    artists: {
      include: {
        artist: {
          include: {
            mappings: true,
          },
        },
      },
    },
    discoveries: {
      where: { userId },
      orderBy: { discoveredAt: "desc" as const },
      take: 1,
    },
    ignoredBy: {
      where: { userId },
      take: 1,
    },
    mappings: true,
  } satisfies Prisma.ReleaseInclude;
}

function sortByUserDiscoveryDate<T extends { discoveries?: { discoveredAt: Date }[]; title: string }>(
  releases: T[],
) {
  return releases.sort((left, right) => {
    const leftDiscoveredAt = left.discoveries?.[0]?.discoveredAt?.getTime() ?? 0;
    const rightDiscoveredAt = right.discoveries?.[0]?.discoveredAt?.getTime() ?? 0;

    if (rightDiscoveredAt !== leftDiscoveredAt) {
      return rightDiscoveredAt - leftDiscoveredAt;
    }

    return left.title.localeCompare(right.title);
  });
}

async function getUserPlatformPreferences(userId: string) {
  return prisma.userPlatformPreference.findMany({
    where: { userId },
    orderBy: [{ favoriteRank: "asc" }, { provider: "asc" }],
  });
}

type ReleaseRecord = Prisma.ReleaseGetPayload<{
  include: ReturnType<typeof releaseInclude>;
}>;

function addReleasePlatformLinks(
  release: ReleaseRecord,
  preferences: Awaited<ReturnType<typeof getUserPlatformPreferences>>,
) {
  const primaryArtistName = release.artists[0]?.artist.canonicalName ?? "Unknown Artist";

  return {
    ...release,
    platformLinks: buildReleasePlatformLinks({
      artistName: primaryArtistName,
      releaseTitle: release.title,
      mappings: release.mappings,
      preferences,
    }),
  };
}

function addArtistPlatformLinks(
  artist: Prisma.ArtistGetPayload<{
    include: {
      mappings: true;
      _count: { select: { releaseArtists: true } };
      releaseArtists: {
        include: {
          release: true;
        };
        orderBy: {
          release: {
            releaseDate: "desc";
          };
        };
        take: 1;
      };
    };
  }>,
  preferences: Awaited<ReturnType<typeof getUserPlatformPreferences>>,
) {
  return {
    artistId: artist.id,
    canonicalName: artist.canonicalName,
    imageUrl: artist.imageUrl,
    deezerFans: artist.deezerFans,
    knownReleaseCount: artist._count.releaseArtists,
    latestKnownRelease: artist.releaseArtists[0]
      ? {
          title: artist.releaseArtists[0].release.title,
          releaseDate: artist.releaseArtists[0].release.releaseDate.toISOString(),
        }
      : null,
    platformLinks: buildArtistPlatformLinks({
      artistName: artist.canonicalName,
      mappings: artist.mappings,
      preferences,
    }),
  };
}

export async function getDashboardData(userId: string) {
  const [settings, preferences] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({
      where: { userId },
    }),
    getUserPlatformPreferences(userId),
  ]);
  const discoveryCutoff = subDays(new Date(), settings.discoveryWindowDays);

  const [followedArtistsCount, upcoming, discoveredReleases] = await Promise.all([
    prisma.userFollow.count({ where: { userId } }),
    prisma.release.findMany({
      where: {
        releaseDate: {
          gte: new Date(),
          lte: horizonDate(settings.futureHorizonDays),
        },
        type: buildReleaseTypeFilter(settings),
        artists: {
          some: {
            artist: {
              followers: {
                some: { userId },
              },
            },
          },
        },
        ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
      },
      include: releaseInclude(userId),
      orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
      take: 24,
    }),
    prisma.release.findMany({
      where: {
        releaseDate: {
          gte: discoveryCutoff,
        },
        type: buildReleaseTypeFilter(settings),
        discoveries: {
          some: {
            userId,
            discoveredAt: {
              gte: discoveryCutoff,
            },
          },
        },
        ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
      },
      include: releaseInclude(userId),
    }),
  ]);
  const filteredUpcoming = filterReleasesForSettings(upcoming, settings)
    .slice(0, 6)
    .map((release) => addReleasePlatformLinks(release, preferences));
  const filteredDiscoveredReleases = filterReleasesForSettings(discoveredReleases, settings);
  const discoveredReleasesCount = filteredDiscoveredReleases.length;
  const discoveries = sortByUserDiscoveryDate(filteredDiscoveredReleases)
    .slice(0, 6)
    .map((release) => addReleasePlatformLinks(release, preferences));

  return {
    settings,
    preferences,
    followedArtistsCount,
    upcoming: filteredUpcoming,
    discoveredReleasesCount,
    discoveries,
  };
}

export async function getFollowedArtists(userId: string) {
  const [followed, preferences] = await Promise.all([
    prisma.userFollow.findMany({
      where: { userId },
      include: {
        artist: {
          include: {
            mappings: true,
            _count: {
              select: {
                releaseArtists: true,
              },
            },
            releaseArtists: {
              include: {
                release: true,
              },
              orderBy: {
                release: {
                  releaseDate: "desc",
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        artist: {
          canonicalName: "asc",
        },
      },
    }),
    getUserPlatformPreferences(userId),
  ]);

  return followed.map((follow) => ({
    ...addArtistPlatformLinks(follow.artist, preferences),
    lastSyncedAt: follow.lastSyncedAt?.toISOString() ?? null,
  }));
}

async function getFilteredReleaseFeed(userId: string, where: Prisma.ReleaseWhereInput) {
  const [settings, preferences, releases] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getUserPlatformPreferences(userId),
    prisma.release.findMany({
      where,
      include: releaseInclude(userId),
      orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
    }),
  ]);

  return filterReleasesForSettings(releases, settings).map((release) =>
    addReleasePlatformLinks(release, preferences),
  );
}

export async function getUpcomingReleases(userId: string) {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });

  return getFilteredReleaseFeed(userId, {
    releaseDate: {
      gte: new Date(),
      lte: horizonDate(settings.futureHorizonDays),
    },
    type: buildReleaseTypeFilter(settings),
    artists: {
      some: {
        artist: {
          followers: {
            some: { userId },
          },
        },
      },
    },
    ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
  });
}

export async function getDiscoveredReleases(userId: string) {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  const discoveryCutoff = subDays(new Date(), settings.discoveryWindowDays);
  const releases = await getFilteredReleaseFeed(userId, {
    releaseDate: {
      gte: discoveryCutoff,
    },
    type: buildReleaseTypeFilter(settings),
    discoveries: {
      some: {
        userId,
        discoveredAt: {
          gte: discoveryCutoff,
        },
      },
    },
    ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
  });

  return sortByUserDiscoveryDate(releases);
}

export async function getUserPlatformPreferencesWithConnections(userId: string) {
  const [preferences, user] = await Promise.all([
    getUserPlatformPreferences(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        deezerConnection: true,
        spotifyConnection: true,
        tidalConnection: true,
        appleMusicConnection: true,
        externalIdentities: true,
      },
    }),
  ]);

  return {
    preferences,
    user,
  };
}

export type { PlatformLinkEntry };
