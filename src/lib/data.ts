import { ReleaseType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  buildArtistPlatformLinks,
  buildReleasePlatformLinks,
  type PlatformLinkEntry,
} from "@/lib/platform-links";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import {
  getDateOffsetUtcDateForTimeZone,
  getTodayUtcDateForTimeZone,
} from "@/lib/timezone";
import { RELEASE_ARTIST_ROLE, type ReleaseArtistRole } from "@/lib/release-artist-role";

export const PRIMARY_RECENT_RELEASE_TYPES = [
  ReleaseType.ALBUM,
  ReleaseType.EP,
  ReleaseType.SINGLE,
] as const;

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

function defaultRecentReleaseTypes(settings: {
  includeSingles: boolean;
  includeEps: boolean;
  includeCompilations: boolean;
  includeLive: boolean;
  includeReissues: boolean;
}) {
  const types: ReleaseType[] = [ReleaseType.ALBUM, ReleaseType.UNKNOWN];

  if (settings.includeEps) types.push(ReleaseType.EP);
  if (settings.includeSingles) types.push(ReleaseType.SINGLE);
  if (settings.includeCompilations) types.push(ReleaseType.COMPILATION);
  if (settings.includeLive) types.push(ReleaseType.LIVE);
  if (settings.includeReissues) types.push(ReleaseType.REISSUE, ReleaseType.REMASTER);

  return types;
}

export function getDefaultRecentReleaseTypes(settings: {
  includeSingles: boolean;
  includeEps: boolean;
  includeCompilations: boolean;
  includeLive: boolean;
  includeReissues: boolean;
}) {
  return defaultRecentReleaseTypes(settings);
}

type ReleaseWithArtists = {
  title: string;
  rawSource: Prisma.JsonValue | null;
  artists: {
    role?: ReleaseArtistRole | string;
    artist: {
      canonicalName: string;
      musicbrainzArtistId?: string;
      isClassicalComposer?: boolean;
      followers?: { userId: string }[];
    };
  }[];
  discoveries?: { discoveredAt: Date }[];
};

function hasUserScopedArtists(release: ReleaseWithArtists) {
  return release.artists.some((entry) => Array.isArray(entry.artist.followers));
}

function getRelevantArtistEntries(
  release: ReleaseWithArtists,
  userId?: string,
) {
  if (!hasUserScopedArtists(release)) {
    return release.artists;
  }

  return release.artists
    .filter((entry) =>
      userId
        ? entry.artist.followers?.some((follow) => follow.userId === userId)
        : (entry.artist.followers?.length ?? 0) > 0,
    );
}

function isHiddenComposerAppearance(release: ReleaseWithArtists, userId?: string) {
  const relevantArtistEntries = getRelevantArtistEntries(release, userId);
  if (relevantArtistEntries.length === 0) {
    return false;
  }

  return relevantArtistEntries.every(
    (entry) => entry.role === RELEASE_ARTIST_ROLE.COMPOSER_APPEARANCE,
  );
}

export function filterReleasesForSettings<T extends ReleaseWithArtists>(
  releases: T[],
  settings: {
    hideClassicalComposerAppearances?: boolean;
    userId?: string;
  },
) {
  if (!settings.hideClassicalComposerAppearances) {
    return releases;
  }

  return releases.filter((release) => {
    return !isHiddenComposerAppearance(release, settings.userId);
  });
}

export function isReleaseVisibleForSettings<T extends ReleaseWithArtists>(
  release: T,
  settings: {
    hideClassicalComposerAppearances?: boolean;
    userId?: string;
  },
) {
  return filterReleasesForSettings([release], settings).length > 0;
}

function releaseInclude(userId: string) {
  return {
    artists: {
      include: {
        artist: {
          include: {
            mappings: true,
            followers: {
              where: { userId },
              select: { userId: true },
              take: 1,
            },
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

function sortByRecentRelease<T extends { releaseDate: Date; discoveries?: { discoveredAt: Date }[]; title: string }>(
  releases: T[],
) {
  return releases.sort((left, right) => {
    const releaseDateDiff = right.releaseDate.getTime() - left.releaseDate.getTime();
    if (releaseDateDiff !== 0) {
      return releaseDateDiff;
    }

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

function buildFollowedReleaseArtistFilter(userId: string): Prisma.ReleaseArtistWhereInput {
  return {
    artist: {
      followers: {
        some: { userId },
      },
    },
  };
}

function buildVisibleFollowedReleaseFilter(
  userId: string,
  settings: {
    hideClassicalComposerAppearances?: boolean;
  },
): Prisma.ReleaseWhereInput {
  const followedArtistFilter = buildFollowedReleaseArtistFilter(userId);

  return {
    artists: {
      some: settings.hideClassicalComposerAppearances
        ? {
            ...followedArtistFilter,
            role: { not: RELEASE_ARTIST_ROLE.COMPOSER_APPEARANCE },
          }
        : followedArtistFilter,
    },
  };
}

export async function getDashboardData(userId: string) {
  const [settings, preferences, user] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({
      where: { userId },
    }),
    getUserPlatformPreferences(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const today = getTodayUtcDateForTimeZone(timeZone);
  const tomorrow = getDateOffsetUtcDateForTimeZone(timeZone, 1);
  const discoveryCutoff = getDateOffsetUtcDateForTimeZone(timeZone, -settings.discoveryWindowDays);
  const horizon = getDateOffsetUtcDateForTimeZone(timeZone, settings.futureHorizonDays);
  const upcomingWhere = {
    releaseDate: {
      gte: tomorrow,
      lte: horizon,
    },
    type: buildReleaseTypeFilter(settings),
    ...buildVisibleFollowedReleaseFilter(userId, settings),
    ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
  } satisfies Prisma.ReleaseWhereInput;

  const [followedArtistsCount, upcomingReleasesCount, upcoming, recentReleases] = await Promise.all([
    prisma.userFollow.count({ where: { userId } }),
    prisma.release.count({
      where: upcomingWhere,
    }),
    prisma.release.findMany({
      where: upcomingWhere,
      include: releaseInclude(userId),
      orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
      take: 6,
    }),
    prisma.release.findMany({
      where: {
        releaseDate: {
          gte: discoveryCutoff,
          lte: today,
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
    }),
  ]);
  const filteredUpcoming = filterReleasesForSettings(upcoming, settings)
    .slice(0, 6)
    .map((release) => addReleasePlatformLinks(release, preferences));
  const filteredRecentReleases = filterReleasesForSettings(recentReleases, settings);
  const recentReleasesCount = filteredRecentReleases.length;
  const recent = sortByRecentRelease(filteredRecentReleases)
    .slice(0, 6)
    .map((release) => addReleasePlatformLinks(release, preferences));

  return {
    settings,
    preferences,
    followedArtistsCount,
    upcomingReleasesCount,
    upcoming: filteredUpcoming,
    recentReleasesCount,
    recent,
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
  const [settings, user] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const tomorrow = getDateOffsetUtcDateForTimeZone(timeZone, 1);
  const horizon = getDateOffsetUtcDateForTimeZone(timeZone, settings.futureHorizonDays);

  return getFilteredReleaseFeed(userId, {
    releaseDate: {
      gte: tomorrow,
      lte: horizon,
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
  return getRecentReleases(userId);
}

export async function getRecentReleases(
  userId: string,
  filters: {
    releaseTypes?: ReleaseType[];
    showIgnored?: boolean;
  } = {},
) {
  const [settings, user] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);
  const timeZone = getEffectiveTimeZone(user.timezone);
  const today = getTodayUtcDateForTimeZone(timeZone);
  const discoveryCutoff = getDateOffsetUtcDateForTimeZone(timeZone, -settings.discoveryWindowDays);
  const releases = await getFilteredReleaseFeed(userId, {
    releaseDate: {
      gte: discoveryCutoff,
      lte: today,
    },
    type: filters.releaseTypes
      ? { in: filters.releaseTypes }
      : buildReleaseTypeFilter(settings),
    artists: {
      some: {
        artist: {
          followers: {
            some: { userId },
          },
        },
      },
    },
    ignoredBy:
      settings.hideIgnored && !filters.showIgnored ? { none: { userId } } : undefined,
  });

  return sortByRecentRelease(releases);
}

export async function getRecentReleasesPageData(
  userId: string,
  filters: {
    releaseTypes?: ReleaseType[];
    showIgnored?: boolean;
  } = {},
) {
  const [settings, releases, followedArtistsCount] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getRecentReleases(userId, filters),
    prisma.userFollow.count({ where: { userId } }),
  ]);

  const defaultRecentReleasesCount =
    filters.releaseTypes || filters.showIgnored
      ? (await getRecentReleases(userId)).length
      : releases.length;

  return {
    settings,
    releases,
    followedArtistsCount,
    defaultRecentReleasesCount,
    defaultReleaseTypes: defaultRecentReleaseTypes(settings),
  };
}

export async function getReleaseDetail(userId: string, releaseId: string) {
  const [settings, preferences, release] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getUserPlatformPreferences(userId),
    prisma.release.findFirst({
      where: {
        id: releaseId,
        artists: {
          some: {
            artist: {
              followers: {
                some: { userId },
              },
            },
          },
        },
      },
      include: releaseInclude(userId),
    }),
  ]);

  if (!release) {
    return null;
  }

  return {
    ...addReleasePlatformLinks(release, preferences),
    visibleForCurrentFilters: isReleaseVisibleForSettings(release, settings),
  };
}

export async function getArtistDetail(userId: string, artistId: string) {
  const [settings, preferences, follow] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getUserPlatformPreferences(userId),
    prisma.userFollow.findUnique({
      where: {
        userId_artistId: {
          userId,
          artistId,
        },
      },
      include: {
        artist: {
          include: {
            mappings: true,
            _count: {
              select: {
                releaseArtists: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!follow) {
    return null;
  }

  const releases = await prisma.release.findMany({
    where: {
      artists: {
        some: {
          artistId,
        },
      },
      type: buildReleaseTypeFilter(settings),
      ignoredBy: settings.hideIgnored ? { none: { userId } } : undefined,
    },
    include: releaseInclude(userId),
    orderBy: [{ releaseDate: "desc" }, { title: "asc" }],
    take: 48,
  });

  return {
    artist: {
      ...addArtistPlatformLinks(
        {
          ...follow.artist,
          releaseArtists: [],
        },
        preferences,
      ),
      mappings: follow.artist.mappings,
      lastSyncedAt: follow.lastSyncedAt?.toISOString() ?? null,
    },
    releases: filterReleasesForSettings(releases, settings).map((release) =>
      addReleasePlatformLinks(release, preferences),
    ),
  };
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
