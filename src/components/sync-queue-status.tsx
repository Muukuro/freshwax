"use client";

import { useEffect, useRef, useState } from "react";

type QueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
};

type QueueJob = {
  id: string;
  title: string;
  state: "active" | "waiting" | "delayed" | "failed";
  scheduledFor: string | null;
  startedAt: string | null;
  failedReason: string | null;
  cancellationRequested: boolean;
};

type QueueScheduler = {
  everyMinutes: number;
  nextRunAt: string | null;
};

type QueueStatus = {
  counts: QueueCounts;
  jobs: QueueJob[];
  scheduler: QueueScheduler | null;
};

async function fetchQueueStatus(): Promise<QueueStatus | null> {
  try {
    const res = await fetch("/api/sync/status");
    if (!res.ok) return null;
    return (await res.json()) as QueueStatus;
  } catch {
    return null;
  }
}

function formatAbsoluteTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function formatIntervalLabel(everyMinutes: number) {
  if (everyMinutes % 60 === 0) {
    const hours = everyMinutes / 60;
    return hours === 1 ? "every hour" : `every ${hours} hours`;
  }

  return everyMinutes === 1 ? "every minute" : `every ${everyMinutes} minutes`;
}

function describeJob(job: QueueJob) {
  switch (job.state) {
    case "active":
      return job.startedAt ? `Started ${formatRelativeTime(job.startedAt)}` : "Running now";
    case "waiting":
      return "Ready to run when the worker is free";
    case "delayed":
      return job.scheduledFor
        ? `Retry due ${formatRelativeTime(job.scheduledFor)}`
        : "Waiting for retry";
    case "failed":
      return job.failedReason ?? "Sync failed";
    default:
      return "";
  }
}

export function SyncQueueStatus() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchQueueStatus().then(setStatus);

    intervalRef.current = setInterval(async () => {
      const updated = await fetchQueueStatus();
      setStatus(updated);

      // Stop polling once the queue is idle
      if (
        updated &&
        updated.counts.waiting === 0 &&
        updated.counts.active === 0 &&
        updated.counts.delayed === 0
      ) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!status) return null;

  const { counts, jobs, scheduler } = status;
  const pending = counts.waiting + counts.delayed;
  const isIdle = pending === 0 && counts.active === 0;

  if (isIdle && counts.failed === 0 && !scheduler) return null;

  return (
    <div className="max-w-sm text-right">
      <p className="text-xs text-[var(--muted)]">
        {counts.active > 0 && (
          <span className="mr-2 inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            {counts.active} syncing
          </span>
        )}
        {pending > 0 && <span className="mr-2">{pending} queued</span>}
        {counts.failed > 0 && <span className="text-red-400">{counts.failed} failed</span>}
      </p>

      {scheduler && (
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          Full refresh runs {formatIntervalLabel(scheduler.everyMinutes)}
          {scheduler.nextRunAt ? `, next around ${formatAbsoluteTime(scheduler.nextRunAt)}` : ""}.
        </p>
      )}

      {jobs.length > 0 && (
        <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted)]">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-2">
              <p className="font-medium text-[var(--text)]">{job.title}</p>
              <p>{describeJob(job)}</p>
              {job.cancellationRequested && (
                <p className="text-amber-300">Cancellation requested</p>
              )}
              {job.scheduledFor && (
                <p>Scheduled for {formatAbsoluteTime(job.scheduledFor)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
