import { Queue } from "bullmq";
import IORedis from "ioredis";

import { env } from "@/lib/env";

const ARTIST_SYNC_CANCEL_PREFIX = "freshwax:artist-sync:cancel:";
const ARTIST_SYNC_CANCEL_TTL_SECONDS = 60 * 60;
const IMPORT_CANCEL_PREFIX = "freshwax:import:cancel:";
const IMPORT_CANCEL_TTL_SECONDS = 60 * 60;

let queueConnection: IORedis | null = null;
let artistSyncQueue: Queue | null = null;
let notificationQueue: Queue | null = null;

function getArtistSyncCancellationKey(jobId: string) {
  return `${ARTIST_SYNC_CANCEL_PREFIX}${jobId}`;
}

function getImportCancellationKey(userId: string) {
  return `${IMPORT_CANCEL_PREFIX}${userId}`;
}

export function getQueueConnection() {
  if (!queueConnection) {
    queueConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return queueConnection;
}

export function getArtistSyncQueue() {
  if (!artistSyncQueue) {
    artistSyncQueue = new Queue("artist-sync", {
      connection: getQueueConnection(),
    });
  }

  return artistSyncQueue;
}

export function getNotificationQueue() {
  if (!notificationQueue) {
    notificationQueue = new Queue("notifications", {
      connection: getQueueConnection(),
    });
  }

  return notificationQueue;
}

export async function enqueueArtistSync(artistId: string) {
  const jobId = `artist-${artistId}`;
  await clearArtistSyncCancellation(jobId);
  await getArtistSyncQueue().add(
    "sync-followed-artist",
    { artistId },
    {
      jobId,
      attempts: env.DEEZER_RATE_LIMIT_RETRIES + 1,
      backoff: {
        type: "exponential",
        delay: env.DEEZER_RATE_LIMIT_BASE_DELAY_MS,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  );
}

export async function enqueueGlobalSync() {
  await getArtistSyncQueue().add(
    "sync-all-artists",
    {},
    {
      jobId: "sync-all",
      attempts: env.DEEZER_RATE_LIMIT_RETRIES + 1,
      backoff: {
        type: "exponential",
        delay: env.DEEZER_RATE_LIMIT_BASE_DELAY_MS,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  );
}

export async function ensureRecurringSync() {
  await getArtistSyncQueue().upsertJobScheduler(
    "scheduled-global-sync",
    {
      every: env.SYNC_INTERVAL_MINUTES * 60 * 1000,
    },
    {
      name: "sync-all-artists",
      data: {},
      opts: {
        attempts: env.DEEZER_RATE_LIMIT_RETRIES + 1,
        backoff: {
          type: "exponential",
          delay: env.DEEZER_RATE_LIMIT_BASE_DELAY_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    },
  );
}

export async function ensureRecurringNotificationDrain() {
  await getNotificationQueue().upsertJobScheduler(
    "scheduled-notification-drain",
    {
      every: 5 * 60 * 1000,
    },
    {
      name: "drain-notifications",
      data: {},
      opts: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    },
  );
}

export async function requestArtistSyncCancellation(jobId: string) {
  await getQueueConnection().set(
    getArtistSyncCancellationKey(jobId),
    "1",
    "EX",
    ARTIST_SYNC_CANCEL_TTL_SECONDS,
  );
}

export async function clearArtistSyncCancellation(jobId: string) {
  await getQueueConnection().del(getArtistSyncCancellationKey(jobId));
}

export async function isArtistSyncCancellationRequested(jobId: string) {
  return (await getQueueConnection().exists(getArtistSyncCancellationKey(jobId))) === 1;
}

export async function requestImportCancellation(userId: string) {
  await getQueueConnection().set(
    getImportCancellationKey(userId),
    "1",
    "EX",
    IMPORT_CANCEL_TTL_SECONDS,
  );
}

export async function clearImportCancellation(userId: string) {
  await getQueueConnection().del(getImportCancellationKey(userId));
}

export async function isImportCancellationRequested(userId: string) {
  return (await getQueueConnection().exists(getImportCancellationKey(userId))) === 1;
}
