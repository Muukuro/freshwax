import type { Job, JobSchedulerJson } from "bullmq";

import { env } from "@/lib/env";
import { getArtistSyncQueue, isArtistSyncCancellationRequested } from "@/lib/queue";
import { prisma } from "@/lib/db";

type QueueJobState = "active" | "waiting" | "delayed" | "failed";

type QueueJobWithState = {
  job: Job;
  state: QueueJobState;
};

const DISPLAY_JOB_LIMIT = 6;

export type SyncQueueJobSummary = {
  id: string;
  title: string;
  state: QueueJobState;
  scheduledFor: string | null;
  startedAt: string | null;
  failedReason: string | null;
  cancellationRequested: boolean;
};

export type SyncQueueSchedulerSummary = {
  everyMinutes: number;
  nextRunAt: string | null;
};

export type SyncQueueStatusSummary = {
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
  };
  jobs: SyncQueueJobSummary[];
  scheduler: SyncQueueSchedulerSummary | null;
};

function isRelevantJob(job: Job, followedArtistNames: Map<string, string>) {
  if (job.name === "sync-all-artists") {
    return true;
  }

  if (job.name !== "sync-followed-artist") {
    return false;
  }

  const artistId =
    job.data &&
    typeof job.data === "object" &&
    "artistId" in job.data &&
    typeof job.data.artistId === "string"
      ? job.data.artistId
      : null;

  return artistId ? followedArtistNames.has(artistId) : false;
}

function buildJobTitle(job: Job, followedArtistNames: Map<string, string>) {
  if (job.name === "sync-all-artists") {
    return "Full library refresh";
  }

  if (job.name === "sync-followed-artist") {
    const artistId =
      job.data &&
      typeof job.data === "object" &&
      "artistId" in job.data &&
      typeof job.data.artistId === "string"
        ? job.data.artistId
        : null;
    const artistName = artistId ? followedArtistNames.get(artistId) : null;

    return artistName ? `Refresh ${artistName}` : "Refresh followed artist";
  }

  return job.name;
}

async function toJobSummary(
  jobWithState: QueueJobWithState,
  followedArtistNames: Map<string, string>,
) {
  const { job, state } = jobWithState;
  const scheduledFor =
    state === "delayed" && job.delay > 0 ? new Date(job.timestamp + job.delay).toISOString() : null;
  const jobId = job.id ?? `${job.name}:${job.timestamp}`;

  return {
    id: jobId,
    title: buildJobTitle(job, followedArtistNames),
    state,
    scheduledFor,
    startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    failedReason: state === "failed" ? job.failedReason || "Sync failed" : null,
    cancellationRequested: job.id
      ? await isArtistSyncCancellationRequested(String(job.id))
      : false,
  } satisfies SyncQueueJobSummary;
}

function buildSchedulerSummary(scheduler: JobSchedulerJson | undefined): SyncQueueSchedulerSummary | null {
  if (!scheduler) {
    return null;
  }

  return {
    everyMinutes: Math.round((scheduler.every ?? env.SYNC_INTERVAL_MINUTES * 60 * 1000) / 60_000),
    nextRunAt: scheduler.next ? new Date(scheduler.next).toISOString() : null,
  };
}

export async function getUserSyncQueueStatus(
  userId: string,
  options?: { jobLimit?: number },
): Promise<SyncQueueStatusSummary> {
  const queue = getArtistSyncQueue();

  const [follows, activeJobs, waitingJobs, delayedJobs, failedJobs, schedulers] = await Promise.all([
    prisma.userFollow.findMany({
      where: { userId },
      select: {
        artistId: true,
        artist: {
          select: {
            canonicalName: true,
          },
        },
      },
    }),
    queue.getActive(0, -1),
    queue.getWaiting(0, -1),
    queue.getDelayed(0, -1),
    queue.getFailed(0, -1),
    queue.getJobSchedulers(0, 9, true),
  ]);

  const followedArtistNames = new Map(
    follows.map((follow) => [follow.artistId, follow.artist.canonicalName]),
  );

  const jobsWithState: QueueJobWithState[] = [
    ...activeJobs.map((job) => ({ job, state: "active" as const })),
    ...waitingJobs.map((job) => ({ job, state: "waiting" as const })),
    ...delayedJobs.map((job) => ({ job, state: "delayed" as const })),
    ...failedJobs.map((job) => ({ job, state: "failed" as const })),
  ].filter(({ job }) => isRelevantJob(job, followedArtistNames));

  const counts = jobsWithState.reduce(
    (acc, { state }) => {
      acc[state] += 1;
      return acc;
    },
    {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    },
  );

  const jobs = jobsWithState
    .sort((a, b) => {
      const aTime = a.state === "delayed" ? a.job.timestamp + a.job.delay : a.job.timestamp;
      const bTime = b.state === "delayed" ? b.job.timestamp + b.job.delay : b.job.timestamp;
      return aTime - bTime;
    })
    .slice(0, options?.jobLimit ?? DISPLAY_JOB_LIMIT);

  const jobSummaries = await Promise.all(
    jobs.map((job) => toJobSummary(job, followedArtistNames)),
  );

  const scheduler = buildSchedulerSummary(
    schedulers.find(
      (candidate) =>
        candidate.key === "scheduled-global-sync" || candidate.id === "scheduled-global-sync",
    ),
  );

  return {
    counts,
    jobs: jobSummaries,
    scheduler,
  };
}
