import test from "node:test";
import assert from "node:assert/strict";

import { buildNotificationCopy } from "@/lib/notification-copy";

const release = {
  title: "Silver Thread",
  releaseDate: new Date("2026-04-21T00:00:00.000Z"),
  artists: [{ artist: { canonicalName: "Avery Moss" } }],
};

test("release-day notification copy leads with artist and title", () => {
  assert.deepEqual(
    buildNotificationCopy({
      kind: "release_day",
      release,
      user: { timezone: "Europe/Amsterdam" },
    }),
    {
      title: "Avery Moss - Silver Thread",
      body: "Out today",
    },
  );
});

test("late-find notification copy includes the original release date", () => {
  assert.deepEqual(
    buildNotificationCopy(
      {
        kind: "release_discovered",
        release,
        user: { timezone: "Europe/Amsterdam" },
      },
      new Date("2026-04-22T08:00:00.000Z"),
    ),
    {
      title: "Avery Moss - Silver Thread",
      body: "Found late · Tue, Apr 21, 2026",
    },
  );
});

test("same-day discovery notification copy identifies releases out today", () => {
  assert.deepEqual(
    buildNotificationCopy(
      {
        kind: "release_discovered",
        release,
        user: { timezone: "America/Los_Angeles" },
      },
      new Date("2026-04-21T18:00:00.000Z"),
    ),
    {
      title: "Avery Moss - Silver Thread",
      body: "Release out today",
    },
  );
});

test("future discovery notification copy includes the upcoming release date", () => {
  assert.deepEqual(
    buildNotificationCopy(
      {
        kind: "release_discovered",
        release,
        user: { timezone: "Europe/Amsterdam" },
      },
      new Date("2026-04-20T08:00:00.000Z"),
    ),
    {
      title: "Avery Moss - Silver Thread",
      body: "Upcoming · Tue, Apr 21, 2026",
    },
  );
});

test("notification copy has a readable fallback when artist data is missing", () => {
  assert.equal(
    buildNotificationCopy({
      kind: "release_discovered",
      release: {
        title: "Untitled",
        releaseDate: new Date("2026-04-21T00:00:00.000Z"),
        artists: [],
      },
      user: { timezone: "Europe/Amsterdam" },
    }).title,
    "Unknown artist - Untitled",
  );
});
