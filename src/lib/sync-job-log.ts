import { JobStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type SyncJobRecord = {
  id: string;
} | null;

let syncJobTableWarningShown = false;

function isMissingSyncJobTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.meta?.modelName === "SyncJob"
  );
}

function warnMissingSyncJobTable() {
  if (syncJobTableWarningShown) {
    return;
  }

  syncJobTableWarningShown = true;
  console.warn(
    "SyncJob table is missing. Apply the current Prisma schema with `npx prisma db push` before relying on sync job history.",
  );
}

export async function createSyncJobLog(data: {
  kind: "SYNC_ALL_ARTISTS" | "SYNC_FOLLOWED_ARTIST";
  userId?: string;
  artistId?: string;
  message: string;
}) {
  try {
    return await prisma.syncJob.create({
      data: {
        ...data,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingSyncJobTableError(error)) {
      warnMissingSyncJobTable();
      return null;
    }

    throw error;
  }
}

export async function updateSyncJobLog(
  syncJob: SyncJobRecord,
  data: {
    status: JobStatus;
    message: string;
  },
) {
  if (!syncJob) {
    return;
  }

  try {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        ...data,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    if (isMissingSyncJobTableError(error)) {
      warnMissingSyncJobTable();
      return;
    }

    throw error;
  }
}
