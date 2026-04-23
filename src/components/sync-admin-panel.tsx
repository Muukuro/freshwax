import { JobKind, JobStatus } from "@prisma/client";
import Link from "next/link";

import {
  cancelAllSyncJobsAction,
  cancelSyncJobAction,
} from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import type { SyncQueueStatusSummary } from "@/lib/sync-queue-status";
import type { AdminSyncJobLog } from "@/lib/sync-admin";
import { formatTimestampInTimeZone } from "@/lib/timezone";

function describeQueueJob(job: SyncQueueStatusSummary["jobs"][number], timeZone: string) {
  if (job.cancellationRequested) {
    return "Cancellation requested";
  }

  switch (job.state) {
    case "active":
      return job.startedAt
        ? `Running since ${formatTimestampInTimeZone(job.startedAt, timeZone)}`
        : "Running now";
    case "waiting":
      return "Queued and waiting for the worker";
    case "delayed":
      return job.scheduledFor
        ? `Retry scheduled for ${formatTimestampInTimeZone(job.scheduledFor, timeZone)}`
        : "Waiting for retry";
    case "failed":
      return job.failedReason ?? "Sync failed";
    default:
      return "";
  }
}

function describeLogKind(kind: JobKind, artistName: string | null) {
  if (kind === JobKind.SYNC_ALL_ARTISTS) {
    return "Full library refresh";
  }

  return artistName ? `Artist sync: ${artistName}` : "Artist sync";
}

function getStatusTone(status: JobStatus) {
  switch (status) {
    case JobStatus.SUCCEEDED:
      return "text-emerald-300";
    case JobStatus.FAILED:
      return "text-red-400";
    case JobStatus.RUNNING:
      return "text-amber-300";
    default:
      return "text-[var(--muted)]";
  }
}

export function SyncAdminPanel({
  queueStatus,
  logs,
  timeZone,
}: {
  queueStatus: SyncQueueStatusSummary;
  logs: AdminSyncJobLog[];
  timeZone: string;
}) {
  const hasQueueJobs = queueStatus.jobs.length > 0;

  return (
    <article className="panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Operator tools</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text)]">Sync admin</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Inspect live queue state, review recent sync outcomes, and cancel jobs that are stuck.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="ghost-button" href="/settings">
            Refresh panel
          </Link>
          {hasQueueJobs ? (
            <form action={cancelAllSyncJobsAction}>
              <SubmitButton className="ghost-button" pendingLabel="Cancelling...">
                Cancel all visible jobs
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Live queue</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="panel-muted p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Active</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{queueStatus.counts.active}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Waiting</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{queueStatus.counts.waiting}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Delayed</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{queueStatus.counts.delayed}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Failed</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{queueStatus.counts.failed}</p>
            </div>
          </div>

          {queueStatus.jobs.length > 0 ? (
            <ul className="space-y-3">
              {queueStatus.jobs.map((job) => (
                <li key={job.id} className="panel-muted flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--text)]">{job.title}</p>
                      <span className="status-pill px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                        {job.state}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      Job ID: <span className="font-mono">{job.id}</span>
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      {describeQueueJob(job, timeZone)}
                    </p>
                  </div>
                  <form action={cancelSyncJobAction}>
                    <input name="jobId" type="hidden" value={job.id} />
                    <SubmitButton
                      className="ghost-button"
                      pendingLabel={job.state === "active" ? "Requesting..." : "Cancelling..."}
                    >
                      {job.state === "active" ? "Request cancel" : "Remove"}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-muted p-4 text-sm leading-6 text-[var(--muted)]">
              No relevant queue jobs are currently visible.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Recent sync logs</h3>
          {logs.length > 0 ? (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} className="panel-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-[var(--text)]">
                      {describeLogKind(log.kind, log.artistName)}
                    </p>
                    <span className={`text-xs font-medium uppercase tracking-[0.18em] ${getStatusTone(log.status)}`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {log.message ?? "No message recorded"}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    Created {formatTimestampInTimeZone(log.createdAt, timeZone)}
                    {log.startedAt ? ` · Started ${formatTimestampInTimeZone(log.startedAt, timeZone)}` : ""}
                    {log.finishedAt ? ` · Finished ${formatTimestampInTimeZone(log.finishedAt, timeZone)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-muted p-4 text-sm leading-6 text-[var(--muted)]">
              No sync history is available yet. If the `SyncJob` table is missing, run `npx prisma db push`.
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
