import { JobStatus } from "@prisma/client";
import { QueueEvents, Worker } from "bullmq";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureRecurringSync, getQueueConnection } from "@/lib/queue";
import { DeezerRateLimitError } from "@/lib/providers/deezer";
import { syncAllArtists, syncArtist } from "@/lib/sync";

async function main() {
  await ensureRecurringSync();

  const queueEvents = new QueueEvents("artist-sync", {
    connection: getQueueConnection(),
  });
  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    console.error(`Job ${jobId} failed: ${failedReason}`);
  });
  queueEvents.on("waiting", ({ jobId }) => {
    if (jobId) {
      console.log(`Queued job ${jobId} for another sync attempt`);
    }
  });

  const worker = new Worker(
    "artist-sync",
    async (job) => {
      if (job.name === "sync-all-artists") {
        const syncJob = await prisma.syncJob.create({
          data: {
            kind: "SYNC_ALL_ARTISTS",
            status: JobStatus.RUNNING,
            startedAt: new Date(),
            message: "Worker started a global sync",
          },
        });

        try {
          await syncAllArtists();
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: JobStatus.SUCCEEDED,
              finishedAt: new Date(),
              message: "Global sync complete",
            },
          });
        } catch (error) {
          await prisma.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: JobStatus.FAILED,
              finishedAt: new Date(),
              message: error instanceof Error ? error.message : "Global sync failed",
            },
          });
          throw error;
        }
      }

      if (job.name === "sync-followed-artist") {
        await syncArtist(job.data.artistId);
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: env.ARTIST_SYNC_CONCURRENCY,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Completed job ${job.id} (${job.name})`);
  });

  worker.on("failed", (job, error) => {
    if (error instanceof DeezerRateLimitError) {
      console.warn(
        `Rate limited while processing job ${job?.id} (${job?.name}); retrying after cooldown`,
      );
      return;
    }

    console.error(`Failed job ${job?.id} (${job?.name}):`, error);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
