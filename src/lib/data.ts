import { ReleaseType, type Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db";
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

function releaseInclude(userId: string) {
  return {
    artists: {
      include: {
        artist: true,
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

export async function getDashboardData(userId: string) {
  const settings = await prisma.userSettings.findUniqueOrThrow({
    where: { userId },
  });
  const discoveryCutoff = subDays(new Date(), settings.discoveryWindowDays);

  const [followedArtistsCount, upcoming, discoveredReleases, latestJob] = await Promise.all([
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
      take: 6,
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
    prisma.syncJob.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const discoveries = sortByUserDiscoveryDate(discoveredReleases).slice(0, 6);

  return {
    settings,
    followedArtistsCount,
    upcoming,
    discoveries,
    latestJob,
  };
}

export async function getFollowedArtists(userId: string) {
  return prisma.userFollow.findMany({
    where: { userId },
    include: {
      artist: {
        include: {
          mappings: true,
          releaseArtists: {
            include: {
              release: true,
            },
            orderBy: {
              release: {
                releaseDate: "asc",
              },
            },
            take: 3,
          },
        },
      },
    },
    orderBy: {
      artist: {
        canonicalName: "asc",
      },
    },
  });
}

export async function getUpcomingReleases(userId: string) {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });

  return prisma.release.findMany({
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
  });
}

export async function getDiscoveredReleases(userId: string) {
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  const discoveryCutoff = subDays(new Date(), settings.discoveryWindowDays);

  const releases = await prisma.release.findMany({
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
  });

  return sortByUserDiscoveryDate(releases);
}
