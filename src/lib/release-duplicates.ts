import {
  NotificationDeliveryStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { RELEASE_ARTIST_ROLE } from "@/lib/release-artist-role";

type Transaction = Prisma.TransactionClient;

export class ReleaseMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseMergeError";
  }
}

export function getLegacyReleaseGroupMbid(rawSource: Prisma.JsonValue | null) {
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
    return null;
  }

  const value = rawSource.releaseGroupId;
  return typeof value === "string" && value.trim() ? value : null;
}

export function chooseReleaseArtistRole(left: string, right: string) {
  if (
    left === RELEASE_ARTIST_ROLE.PRIMARY ||
    right === RELEASE_ARTIST_ROLE.PRIMARY
  ) {
    return RELEASE_ARTIST_ROLE.PRIMARY;
  }

  return left;
}

const DELIVERY_STATUS_PRIORITY: Record<NotificationDeliveryStatus, number> = {
  [NotificationDeliveryStatus.FAILED]: 0,
  [NotificationDeliveryStatus.PENDING]: 1,
  [NotificationDeliveryStatus.DELIVERED]: 2,
};

export function chooseDeliveryStatus(
  left: NotificationDeliveryStatus,
  right: NotificationDeliveryStatus,
) {
  return DELIVERY_STATUS_PRIORITY[right] > DELIVERY_STATUS_PRIORITY[left]
    ? right
    : left;
}

type IdentityMatch = {
  id: string;
  releaseGroupMbid: string | null;
};

export function selectReleaseIdentityMatch<T extends IdentityMatch>(input: {
  incomingReleaseGroupMbid: string | null | undefined;
  byMusicBrainz: T | null;
  byProvider: T | null;
  byShape: T | null;
}) {
  if (input.byMusicBrainz) return input.byMusicBrainz;
  if (input.byProvider) return input.byProvider;

  if (
    input.byShape &&
    input.incomingReleaseGroupMbid &&
    input.byShape.releaseGroupMbid &&
    input.incomingReleaseGroupMbid !== input.byShape.releaseGroupMbid
  ) {
    return null;
  }

  return input.byShape;
}

function chooseNotificationStatus(left: string, right: string) {
  const priority: Record<string, number> = {
    failed: 0,
    pending: 1,
    delivered: 2,
  };
  return (priority[right] ?? 0) > (priority[left] ?? 0) ? right : left;
}

function earlier(left: Date, right: Date) {
  return left <= right ? left : right;
}

function later(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

async function mergeReleaseArtists(
  tx: Transaction,
  survivingReleaseId: string,
  duplicateReleaseId: string,
) {
  const duplicateArtists = await tx.releaseArtist.findMany({
    where: { releaseId: duplicateReleaseId },
  });

  for (const duplicateArtist of duplicateArtists) {
    const survivorArtist = await tx.releaseArtist.findUnique({
      where: {
        releaseId_artistId: {
          releaseId: survivingReleaseId,
          artistId: duplicateArtist.artistId,
        },
      },
    });

    if (survivorArtist) {
      await tx.releaseArtist.update({
        where: {
          releaseId_artistId: {
            releaseId: survivingReleaseId,
            artistId: duplicateArtist.artistId,
          },
        },
        data: {
          role: chooseReleaseArtistRole(
            survivorArtist.role,
            duplicateArtist.role,
          ),
        },
      });
      await tx.releaseArtist.delete({
        where: {
          releaseId_artistId: {
            releaseId: duplicateReleaseId,
            artistId: duplicateArtist.artistId,
          },
        },
      });
    } else {
      await tx.releaseArtist.update({
        where: {
          releaseId_artistId: {
            releaseId: duplicateReleaseId,
            artistId: duplicateArtist.artistId,
          },
        },
        data: { releaseId: survivingReleaseId },
      });
    }
  }
}

async function mergeDiscoveries(
  tx: Transaction,
  survivingReleaseId: string,
  duplicateReleaseId: string,
) {
  const discoveries = await tx.discoveryEvent.findMany({
    where: { releaseId: duplicateReleaseId },
  });

  for (const discovery of discoveries) {
    const survivorDiscovery = await tx.discoveryEvent.findUnique({
      where: {
        userId_releaseId: {
          userId: discovery.userId,
          releaseId: survivingReleaseId,
        },
      },
    });

    if (!survivorDiscovery) {
      await tx.discoveryEvent.update({
        where: { id: discovery.id },
        data: { releaseId: survivingReleaseId },
      });
      continue;
    }

    const duplicateWasEarlier =
      discovery.discoveredAt < survivorDiscovery.discoveredAt;
    await tx.discoveryEvent.update({
      where: { id: survivorDiscovery.id },
      data: {
        discoveredAt: earlier(
          survivorDiscovery.discoveredAt,
          discovery.discoveredAt,
        ),
        reason: duplicateWasEarlier
          ? discovery.reason
          : survivorDiscovery.reason,
        artistId: survivorDiscovery.artistId ?? discovery.artistId,
      },
    });
    await tx.discoveryEvent.delete({ where: { id: discovery.id } });
  }
}

async function mergeIgnores(
  tx: Transaction,
  survivingReleaseId: string,
  duplicateReleaseId: string,
) {
  const ignores = await tx.ignoredRelease.findMany({
    where: { releaseId: duplicateReleaseId },
  });

  for (const ignore of ignores) {
    const survivorIgnore = await tx.ignoredRelease.findUnique({
      where: {
        userId_releaseId: {
          userId: ignore.userId,
          releaseId: survivingReleaseId,
        },
      },
    });

    if (survivorIgnore) {
      if (ignore.createdAt < survivorIgnore.createdAt) {
        await tx.ignoredRelease.update({
          where: {
            userId_releaseId: {
              userId: ignore.userId,
              releaseId: survivingReleaseId,
            },
          },
          data: { createdAt: ignore.createdAt },
        });
      }
      await tx.ignoredRelease.delete({
        where: {
          userId_releaseId: {
            userId: ignore.userId,
            releaseId: duplicateReleaseId,
          },
        },
      });
    } else {
      await tx.ignoredRelease.update({
        where: {
          userId_releaseId: {
            userId: ignore.userId,
            releaseId: duplicateReleaseId,
          },
        },
        data: { releaseId: survivingReleaseId },
      });
    }
  }
}

async function mergeNotificationDeliveries(
  tx: Transaction,
  survivingEventId: string,
  duplicateEventId: string,
) {
  const deliveries = await tx.notificationDelivery.findMany({
    where: { eventId: duplicateEventId },
  });

  for (const delivery of deliveries) {
    const survivorDelivery = await tx.notificationDelivery.findUnique({
      where: {
        eventId_channel_targetKey: {
          eventId: survivingEventId,
          channel: delivery.channel,
          targetKey: delivery.targetKey,
        },
      },
    });

    if (!survivorDelivery) {
      await tx.notificationDelivery.update({
        where: { id: delivery.id },
        data: { eventId: survivingEventId },
      });
      continue;
    }

    await tx.notificationDelivery.update({
      where: { id: survivorDelivery.id },
      data: {
        status: chooseDeliveryStatus(
          survivorDelivery.status,
          delivery.status,
        ),
        lastAttemptedAt: later(
          survivorDelivery.lastAttemptedAt,
          delivery.lastAttemptedAt,
        ),
        deliveredAt:
          survivorDelivery.deliveredAt && delivery.deliveredAt
            ? earlier(survivorDelivery.deliveredAt, delivery.deliveredAt)
            : survivorDelivery.deliveredAt ?? delivery.deliveredAt,
        lastError:
          chooseDeliveryStatus(survivorDelivery.status, delivery.status) ===
          NotificationDeliveryStatus.DELIVERED
            ? null
            : survivorDelivery.lastError ?? delivery.lastError,
      },
    });
    await tx.notificationDelivery.delete({ where: { id: delivery.id } });
  }
}

async function mergeNotifications(
  tx: Transaction,
  survivingReleaseId: string,
  duplicateReleaseId: string,
) {
  const notifications = await tx.notificationEvent.findMany({
    where: { releaseId: duplicateReleaseId },
  });

  for (const notification of notifications) {
    const survivorNotification = await tx.notificationEvent.findUnique({
      where: {
        userId_releaseId_kind: {
          userId: notification.userId,
          releaseId: survivingReleaseId,
          kind: notification.kind,
        },
      },
    });

    if (!survivorNotification) {
      await tx.notificationEvent.update({
        where: { id: notification.id },
        data: { releaseId: survivingReleaseId },
      });
      continue;
    }

    await mergeNotificationDeliveries(
      tx,
      survivorNotification.id,
      notification.id,
    );
    const status = chooseNotificationStatus(
      survivorNotification.status,
      notification.status,
    );
    await tx.notificationEvent.update({
      where: { id: survivorNotification.id },
      data: {
        status,
        scheduledFor: earlier(
          survivorNotification.scheduledFor,
          notification.scheduledFor,
        ),
        lastAttemptedAt: later(
          survivorNotification.lastAttemptedAt,
          notification.lastAttemptedAt,
        ),
        deliveredAt:
          survivorNotification.deliveredAt && notification.deliveredAt
            ? earlier(
                survivorNotification.deliveredAt,
                notification.deliveredAt,
              )
            : survivorNotification.deliveredAt ?? notification.deliveredAt,
        lastError:
          status === "delivered"
            ? null
            : survivorNotification.lastError ?? notification.lastError,
      },
    });
    await tx.notificationEvent.delete({ where: { id: notification.id } });
  }
}

export async function mergeDuplicateReleases(input: {
  survivingReleaseId: string;
  duplicateReleaseId: string;
  authorizedUserId?: string;
}) {
  if (input.survivingReleaseId === input.duplicateReleaseId) {
    throw new ReleaseMergeError("A release cannot be merged into itself");
  }

  return prisma.$transaction(async (tx) => {
    const [survivor, duplicate] = await Promise.all([
      tx.release.findUnique({ where: { id: input.survivingReleaseId } }),
      tx.release.findUnique({ where: { id: input.duplicateReleaseId } }),
    ]);

    if (!survivor || !duplicate) {
      throw new ReleaseMergeError("Both releases must exist");
    }

    if (input.authorizedUserId) {
      const sharedFollowedArtist = await tx.releaseArtist.findFirst({
        where: {
          releaseId: input.survivingReleaseId,
          artist: {
            followers: { some: { userId: input.authorizedUserId } },
            releaseArtists: {
              some: { releaseId: input.duplicateReleaseId },
            },
          },
        },
        select: { artistId: true },
      });

      if (!sharedFollowedArtist) {
        throw new ReleaseMergeError(
          "Both releases must share an artist followed by the current user",
        );
      }
    }

    await mergeReleaseArtists(
      tx,
      input.survivingReleaseId,
      input.duplicateReleaseId,
    );
    await tx.releaseProviderMapping.updateMany({
      where: { releaseId: input.duplicateReleaseId },
      data: { releaseId: input.survivingReleaseId },
    });
    await mergeDiscoveries(
      tx,
      input.survivingReleaseId,
      input.duplicateReleaseId,
    );
    await mergeIgnores(
      tx,
      input.survivingReleaseId,
      input.duplicateReleaseId,
    );
    await mergeNotifications(
      tx,
      input.survivingReleaseId,
      input.duplicateReleaseId,
    );

    const releaseGroupMbid =
      survivor.releaseGroupMbid ??
      duplicate.releaseGroupMbid ??
      getLegacyReleaseGroupMbid(survivor.rawSource) ??
      getLegacyReleaseGroupMbid(duplicate.rawSource);

    if (duplicate.releaseGroupMbid) {
      await tx.release.update({
        where: { id: duplicate.id },
        data: { releaseGroupMbid: null },
      });
    }

    await tx.release.update({
      where: { id: survivor.id },
      data: {
        releaseGroupMbid,
        firstDiscoveredAt: earlier(
          survivor.firstDiscoveredAt,
          duplicate.firstDiscoveredAt,
        ),
        lastSeenAt: later(survivor.lastSeenAt, duplicate.lastSeenAt)!,
      },
    });
    await tx.release.delete({ where: { id: duplicate.id } });

    return survivor.id;
  });
}

export async function mergeDuplicateReleasesForUser(input: {
  userId: string;
  survivingReleaseId: string;
  duplicateReleaseId: string;
}) {
  if (input.survivingReleaseId === input.duplicateReleaseId) {
    throw new ReleaseMergeError("A release cannot be merged into itself");
  }

  return mergeDuplicateReleases({
    survivingReleaseId: input.survivingReleaseId,
    duplicateReleaseId: input.duplicateReleaseId,
    authorizedUserId: input.userId,
  });
}

export async function findDuplicateReleaseCandidates(
  userId: string,
  releaseId: string,
) {
  const release = await prisma.release.findFirst({
    where: {
      id: releaseId,
      artists: {
        some: { artist: { followers: { some: { userId } } } },
      },
    },
    select: {
      normalizedTitle: true,
      artists: {
        where: { artist: { followers: { some: { userId } } } },
        select: { artistId: true },
      },
    },
  });

  if (!release) return [];
  const followedArtistIds = release.artists.map((entry) => entry.artistId);

  return prisma.release.findMany({
    where: {
      id: { not: releaseId },
      normalizedTitle: release.normalizedTitle,
      artists: { some: { artistId: { in: followedArtistIds } } },
    },
    select: {
      id: true,
      title: true,
      releaseDate: true,
      releaseGroupMbid: true,
      mappings: {
        select: { provider: true, providerReleaseId: true },
        orderBy: { provider: "asc" },
      },
      artists: {
        select: {
          artist: { select: { id: true, canonicalName: true } },
        },
      },
    },
    orderBy: [{ releaseDate: "desc" }, { createdAt: "asc" }],
  });
}
