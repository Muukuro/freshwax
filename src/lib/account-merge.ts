import { randomBytes } from "node:crypto";
import { addMinutes } from "date-fns";
import { cookies } from "next/headers";
import { Provider, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getProviderLabel } from "@/lib/platforms";

export const ACCOUNT_MERGE_COOKIE = "freshwax_account_merge";

type Transaction = Prisma.TransactionClient;

export class AccountMergeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountMergeConflictError";
  }
}

export async function createAccountMergeIntent(input: {
  targetUserId: string;
  sourceUserId: string;
  provider: Provider;
  providerUserId: string;
}) {
  await prisma.pendingAccountMerge.deleteMany({
    where: {
      OR: [
        { targetUserId: input.targetUserId, provider: input.provider },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  const token = randomBytes(32).toString("hex");

  await prisma.pendingAccountMerge.create({
    data: {
      token,
      targetUserId: input.targetUserId,
      sourceUserId: input.sourceUserId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      expiresAt: addMinutes(new Date(), 15),
    },
  });

  return token;
}

export async function setAccountMergeCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(ACCOUNT_MERGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
}

export async function clearAccountMergeCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_MERGE_COOKIE)?.value;

  if (token) {
    await prisma.pendingAccountMerge.deleteMany({
      where: { token },
    });
  }

  cookieStore.delete(ACCOUNT_MERGE_COOKIE);
}

export async function getPendingAccountMergeForUser(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_MERGE_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const intent = await prisma.pendingAccountMerge.findUnique({
    where: { token },
  });

  if (!intent || intent.targetUserId !== userId || intent.expiresAt < new Date()) {
    return null;
  }

  const [sourceUser, targetUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: intent.sourceUserId },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: intent.targetUserId },
      select: { id: true, email: true, name: true },
    }),
  ]);

  if (!sourceUser || !targetUser) {
    return null;
  }

  return {
    provider: intent.provider,
    providerLabel: getProviderLabel(intent.provider),
    providerUserId: intent.providerUserId,
    sourceUser,
    targetUser,
    expiresAt: intent.expiresAt,
  };
}

async function assertNoConnectionConflict(tx: Transaction, intent: {
  sourceUserId: string;
  targetUserId: string;
}) {
  const [
    sourceDeezer,
    targetDeezer,
    sourceSpotify,
    targetSpotify,
    sourceTidal,
    targetTidal,
    sourceAppleMusic,
    targetAppleMusic,
  ] = await Promise.all([
    tx.deezerConnection.findUnique({ where: { userId: intent.sourceUserId } }),
    tx.deezerConnection.findUnique({ where: { userId: intent.targetUserId } }),
    tx.spotifyConnection.findUnique({ where: { userId: intent.sourceUserId } }),
    tx.spotifyConnection.findUnique({ where: { userId: intent.targetUserId } }),
    tx.tidalConnection.findUnique({ where: { userId: intent.sourceUserId } }),
    tx.tidalConnection.findUnique({ where: { userId: intent.targetUserId } }),
    tx.appleMusicConnection.findUnique({ where: { userId: intent.sourceUserId } }),
    tx.appleMusicConnection.findUnique({ where: { userId: intent.targetUserId } }),
  ]);

  if (sourceDeezer && targetDeezer && sourceDeezer.deezerUserId !== targetDeezer.deezerUserId) {
    throw new AccountMergeConflictError("Disconnect the current Deezer account before merging this account.");
  }

  if (sourceSpotify && targetSpotify && sourceSpotify.spotifyUserId !== targetSpotify.spotifyUserId) {
    throw new AccountMergeConflictError("Disconnect the current Spotify account before merging this account.");
  }

  if (sourceTidal && targetTidal && sourceTidal.tidalUserId !== targetTidal.tidalUserId) {
    throw new AccountMergeConflictError("Disconnect the current TIDAL account before merging this account.");
  }

  if (
    sourceAppleMusic &&
    targetAppleMusic &&
    sourceAppleMusic.appleMusicUserId &&
    targetAppleMusic.appleMusicUserId &&
    sourceAppleMusic.appleMusicUserId !== targetAppleMusic.appleMusicUserId
  ) {
    throw new AccountMergeConflictError("Disconnect the current Apple Music account before merging this account.");
  }
}

async function moveSingleUserRows(tx: Transaction, sourceUserId: string, targetUserId: string) {
  const [sourceSettings, targetSettings] = await Promise.all([
    tx.userSettings.findUnique({ where: { userId: sourceUserId } }),
    tx.userSettings.findUnique({ where: { userId: targetUserId } }),
  ]);

  if (sourceSettings && !targetSettings) {
    await tx.userSettings.update({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.userSettings.deleteMany({ where: { userId: sourceUserId } });
  }

  const [sourceLastfm, targetLastfm] = await Promise.all([
    tx.lastfmConnection.findUnique({ where: { userId: sourceUserId } }),
    tx.lastfmConnection.findUnique({ where: { userId: targetUserId } }),
  ]);

  if (sourceLastfm && !targetLastfm) {
    await tx.lastfmConnection.update({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.lastfmConnection.deleteMany({ where: { userId: sourceUserId } });
  }

  await tx.calendarToken.deleteMany({ where: { userId: sourceUserId } });
  await tx.userPlatformPreference.deleteMany({ where: { userId: sourceUserId } });
}

async function moveProviderConnections(tx: Transaction, sourceUserId: string, targetUserId: string) {
  if (!(await tx.deezerConnection.findUnique({ where: { userId: targetUserId } }))) {
    await tx.deezerConnection.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.deezerConnection.deleteMany({ where: { userId: sourceUserId } });
  }

  if (!(await tx.spotifyConnection.findUnique({ where: { userId: targetUserId } }))) {
    await tx.spotifyConnection.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.spotifyConnection.deleteMany({ where: { userId: sourceUserId } });
  }

  if (!(await tx.tidalConnection.findUnique({ where: { userId: targetUserId } }))) {
    await tx.tidalConnection.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.tidalConnection.deleteMany({ where: { userId: sourceUserId } });
  }

  if (!(await tx.appleMusicConnection.findUnique({ where: { userId: targetUserId } }))) {
    await tx.appleMusicConnection.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } });
  } else {
    await tx.appleMusicConnection.deleteMany({ where: { userId: sourceUserId } });
  }
}

async function mergeCollectionRows(tx: Transaction, sourceUserId: string, targetUserId: string) {
  const follows = await tx.userFollow.findMany({ where: { userId: sourceUserId } });
  if (follows.length > 0) {
    await tx.userFollow.createMany({
      data: follows.map(({ artistId, createdAt, lastSyncedAt }) => ({
        userId: targetUserId,
        artistId,
        createdAt,
        lastSyncedAt,
      })),
      skipDuplicates: true,
    });
  }
  await tx.userFollow.deleteMany({ where: { userId: sourceUserId } });

  const discoveries = await tx.discoveryEvent.findMany({ where: { userId: sourceUserId } });
  if (discoveries.length > 0) {
    await tx.discoveryEvent.createMany({
      data: discoveries.map(({ releaseId, artistId, reason, discoveredAt }) => ({
        userId: targetUserId,
        releaseId,
        artistId,
        reason,
        discoveredAt,
      })),
      skipDuplicates: true,
    });
  }
  await tx.discoveryEvent.deleteMany({ where: { userId: sourceUserId } });

  const ignoredReleases = await tx.ignoredRelease.findMany({ where: { userId: sourceUserId } });
  if (ignoredReleases.length > 0) {
    await tx.ignoredRelease.createMany({
      data: ignoredReleases.map(({ releaseId, createdAt }) => ({
        userId: targetUserId,
        releaseId,
        createdAt,
      })),
      skipDuplicates: true,
    });
  }
  await tx.ignoredRelease.deleteMany({ where: { userId: sourceUserId } });
}

async function mergeNotificationRows(tx: Transaction, sourceUserId: string, targetUserId: string) {
  const notifications = await tx.notificationEvent.findMany({
    where: { userId: sourceUserId },
    select: { id: true, releaseId: true, kind: true },
  });

  for (const notification of notifications) {
    const duplicate = await tx.notificationEvent.findUnique({
      where: {
        userId_releaseId_kind: {
          userId: targetUserId,
          releaseId: notification.releaseId,
          kind: notification.kind,
        },
      },
    });

    if (duplicate) {
      await tx.notificationEvent.delete({ where: { id: notification.id } });
    } else {
      await tx.notificationEvent.update({
        where: { id: notification.id },
        data: { userId: targetUserId },
      });
    }
  }
}

async function mergePushSubscriptions(tx: Transaction, sourceUserId: string, targetUserId: string) {
  const subscriptions = await tx.pushSubscription.findMany({
    where: { userId: sourceUserId },
    select: { id: true, endpoint: true },
  });

  for (const subscription of subscriptions) {
    const duplicate = await tx.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (duplicate && duplicate.userId !== sourceUserId) {
      await tx.pushSubscription.delete({ where: { id: subscription.id } });
    } else {
      await tx.pushSubscription.update({
        where: { id: subscription.id },
        data: { userId: targetUserId },
      });
    }
  }
}

export async function mergePendingAccountIntoTarget(targetUserId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_MERGE_COOKIE)?.value;

  if (!token) {
    throw new AccountMergeConflictError("The account merge request has expired. Start the connection flow again.");
  }

  const intent = await prisma.pendingAccountMerge.findUnique({
    where: { token },
  });

  if (!intent || intent.targetUserId !== targetUserId || intent.expiresAt < new Date()) {
    throw new AccountMergeConflictError("The account merge request has expired. Start the connection flow again.");
  }

  if (intent.sourceUserId === targetUserId) {
    await clearAccountMergeCookie();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const identity = await tx.externalIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: intent.provider,
          providerUserId: intent.providerUserId,
        },
      },
    });

    if (!identity || identity.userId !== intent.sourceUserId) {
      throw new AccountMergeConflictError("The external account is no longer attached to the account being merged.");
    }

    await assertNoConnectionConflict(tx, intent);
    await moveSingleUserRows(tx, intent.sourceUserId, intent.targetUserId);
    await moveProviderConnections(tx, intent.sourceUserId, intent.targetUserId);
    await mergeCollectionRows(tx, intent.sourceUserId, intent.targetUserId);
    await mergeNotificationRows(tx, intent.sourceUserId, intent.targetUserId);
    await mergePushSubscriptions(tx, intent.sourceUserId, intent.targetUserId);

    await tx.syncJob.updateMany({
      where: { userId: intent.sourceUserId },
      data: { userId: intent.targetUserId },
    });
    await tx.externalIdentity.updateMany({
      where: { userId: intent.sourceUserId },
      data: { userId: intent.targetUserId },
    });
    await tx.session.deleteMany({ where: { userId: intent.sourceUserId } });
    await tx.pendingAccountMerge.deleteMany({
      where: {
        OR: [{ token }, { sourceUserId: intent.sourceUserId }, { targetUserId: intent.sourceUserId }],
      },
    });
    await tx.user.delete({ where: { id: intent.sourceUserId } });
  });

  cookieStore.delete(ACCOUNT_MERGE_COOKIE);
}
