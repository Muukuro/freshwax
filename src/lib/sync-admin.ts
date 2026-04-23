import type { Job } from "bullmq";
import { JobKind, type JobStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  getArtistSyncQueue,
  requestArtistSyncCancellation,
} from "@/lib/queue";

function isSchedulerOwnedRemovalError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("belongs to a job scheduler and cannot be removed directly")
  );
}

export type AdminSyncJobLog = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  message: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  artistName: string | null;
};

function getArtistIdFromJob(job: Job) {
  return job.data &&
    typeof job.data === "object" &&
    "artistId" in job.data &&
    typeof job.data.artistId === "string"
    ? job.data.artistId
    : null;
}

async function getFollowedArtistIds(userId: string) {
  const follows = await prisma.userFollow.findMany({
    where: { userId },
    select: { artistId: true },
  });

  return new Set(follows.map((follow) => follow.artistId));
}

function isRelevantSyncJob(job: Job, followedArtistIds: Set<string>) {
  if (job.name === "sync-all-artists") {
    return true;
  }

  if (job.name !== "sync-followed-artist") {
    return false;
  }

  const artistId = getArtistIdFromJob(job);
  return artistId ? followedArtistIds.has(artistId) : false;
}

async function getRelevantQueueJobsForUser(userId: string) {
  const queue = getArtistSyncQueue();
  const followedArtistIds = await getFollowedArtistIds(userId);
  const [activeJobs, waitingJobs, delayedJobs, failedJobs] = await Promise.all([
    queue.getActive(0, -1),
    queue.getWaiting(0, -1),
    queue.getDelayed(0, -1),
    queue.getFailed(0, -1),
  ]);

  return [
    ...activeJobs.map((job) => ({ job, state: "active" as const })),
    ...waitingJobs.map((job) => ({ job, state: "waiting" as const })),
    ...delayedJobs.map((job) => ({ job, state: "delayed" as const })),
    ...failedJobs.map((job) => ({ job, state: "failed" as const })),
  ].filter(({ job }) => isRelevantSyncJob(job, followedArtistIds));
}

export async function cancelUserSyncQueueJob(userId: string, jobId: string) {
  const queue = getArtistSyncQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return false;
  }

  const followedArtistIds = await getFollowedArtistIds(userId);
  if (!isRelevantSyncJob(job, followedArtistIds)) {
    return false;
  }

  const state = await job.getState();

  if (state === "active") {
    await requestArtistSyncCancellation(jobId);
    return true;
  }

  if (
    state === "waiting" ||
    state === "delayed" ||
    state === "failed" ||
    state === "waiting-children"
  ) {
    try {
      await job.remove();
    } catch (error) {
      if (!isSchedulerOwnedRemovalError(error)) {
        throw error;
      }

      await requestArtistSyncCancellation(jobId);
    }
    return true;
  }

  return false;
}

export async function cancelAllUserSyncQueueJobs(userId: string) {
  const jobs = await getRelevantQueueJobsForUser(userId);

  await Promise.all(
    jobs.map(async ({ job, state }) => {
      const jobId = job.id;
      if (!jobId) {
        return;
      }

      if (state === "active") {
        await requestArtistSyncCancellation(String(jobId));
        return;
      }

      try {
        await job.remove();
      } catch (error) {
        if (!isSchedulerOwnedRemovalError(error)) {
          throw error;
        }

        await requestArtistSyncCancellation(String(jobId));
      }
    }),
  );
}

export async function getUserSyncAdminLogs(userId: string, limit = 20): Promise<AdminSyncJobLog[]> {
  const followedArtistIds = [...(await getFollowedArtistIds(userId))];

  const logs = await prisma.syncJob.findMany({
    where: {
      OR: [
        { kind: JobKind.SYNC_ALL_ARTISTS },
        { userId },
        ...(followedArtistIds.length > 0 ? [{ artistId: { in: followedArtistIds } }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      artist: {
        select: {
          canonicalName: true,
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    kind: log.kind,
    status: log.status,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
    startedAt: log.startedAt?.toISOString() ?? null,
    finishedAt: log.finishedAt?.toISOString() ?? null,
    artistName: log.artist?.canonicalName ?? null,
  }));
}
