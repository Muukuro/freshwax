import { JobKind, JobStatus } from "@prisma/client";
import { subMinutes } from "date-fns";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isBackgroundSchemaReady } from "@/lib/schema-ready";

const STARTUP_SYNC_FLOOR_MINUTES = 15;

function syncStalenessThreshold() {
  return subMinutes(new Date(), Math.min(env.SYNC_INTERVAL_MINUTES, STARTUP_SYNC_FLOOR_MINUTES));
}

export async function ensureAppSyncForUser(userId: string) {
  if (!(await isBackgroundSchemaReady())) {
    return;
  }

  const followedArtistsCount = await prisma.userFollow.count({
    where: { userId },
  });

  if (followedArtistsCount === 0) {
    return;
  }

  const staleBefore = syncStalenessThreshold();
  const activeOrFreshJob = await prisma.syncJob.findFirst({
    where: {
      OR: [
        {
          kind: JobKind.SYNC_ALL_ARTISTS,
          status: {
            in: [JobStatus.PENDING, JobStatus.RUNNING],
          },
        },
        {
          kind: JobKind.SYNC_ALL_ARTISTS,
          status: JobStatus.SUCCEEDED,
          createdAt: {
            gte: staleBefore,
          },
        },
      ],
    },
    select: { id: true },
  });

  if (activeOrFreshJob) {
    return;
  }

  try {
    const { enqueueGlobalSync } = await import("@/lib/queue");
    await enqueueGlobalSync();
  } catch (error) {
    console.error("Failed to schedule an automatic sync", error);
  }
}
