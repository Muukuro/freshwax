"use client";

import { useEffect, useRef, useState } from "react";

type QueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

async function fetchQueueStatus(): Promise<QueueCounts | null> {
  try {
    const res = await fetch("/api/sync/status");
    if (!res.ok) return null;
    const data = (await res.json()) as { counts: QueueCounts };
    return data.counts;
  } catch {
    return null;
  }
}

export function SyncQueueStatus() {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchQueueStatus().then(setCounts);

    intervalRef.current = setInterval(async () => {
      const updated = await fetchQueueStatus();
      setCounts(updated);

      // Stop polling once the queue is idle
      if (updated && updated.waiting === 0 && updated.active === 0 && updated.delayed === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!counts) return null;

  const pending = counts.waiting + counts.delayed;
  const isIdle = pending === 0 && counts.active === 0;

  if (isIdle && counts.failed === 0) return null;

  return (
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
  );
}
