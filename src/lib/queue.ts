import { Queue } from "bullmq";
import IORedis from "ioredis";

import { env } from "@/lib/env";

let queueConnection: IORedis | null = null;
let artistSyncQueue: Queue | null = null;

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

export async function enqueueArtistSync(artistId: string) {
  await getArtistSyncQueue().add(
    "sync-followed-artist",
    { artistId },
    {
      jobId: `artist-${artistId}`,
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
