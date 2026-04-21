import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppDefaultTimeZone } from "@/lib/timezone-server";
import {
  addDaysToDateKey,
  formatReleaseDate,
  getDateOffsetUtcDateForTimeZone,
  getTodayDateKey,
  isDiscoveredLate,
  isValidTimeZone,
  serializeDateOnlyForIcs,
} from "@/lib/timezone";

test("validates IANA timezone identifiers", () => {
  assert.equal(isValidTimeZone("Europe/Amsterdam"), true);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);
});

test("resolves the app default from DEFAULT_TIMEZONE before TZ", () => {
  assert.equal(
    resolveAppDefaultTimeZone("America/New_York", "Europe/Amsterdam"),
    "America/New_York",
  );
});

test("falls back from TZ to UTC when needed", () => {
  assert.equal(resolveAppDefaultTimeZone(undefined, "Europe/Amsterdam"), "Europe/Amsterdam");
  assert.equal(resolveAppDefaultTimeZone(undefined, "Invalid/Timezone"), "UTC");
});

test("computes timezone-aware date boundaries without shifting release dates", () => {
  const now = new Date("2026-04-21T00:30:00.000Z");

  assert.equal(getTodayDateKey("America/Los_Angeles", now), "2026-04-20");
  assert.equal(getTodayDateKey("Europe/Amsterdam", now), "2026-04-21");
  assert.equal(addDaysToDateKey("2026-04-20", 10), "2026-04-30");
  assert.equal(
    getDateOffsetUtcDateForTimeZone("America/Los_Angeles", 0, now).toISOString(),
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(
    serializeDateOnlyForIcs(new Date("2026-04-21T00:00:00.000Z")),
    "20260421",
  );
  assert.equal(
    formatReleaseDate(new Date("2026-04-21T00:00:00.000Z")),
    "Tue, Apr 21, 2026",
  );
});

test("marks late discoveries by local day, not server-local end of day", () => {
  const releaseDate = new Date("2026-04-21T00:00:00.000Z");

  assert.equal(
    isDiscoveredLate(
      new Date("2026-04-22T00:30:00.000Z"),
      releaseDate,
      "Europe/Amsterdam",
    ),
    true,
  );
  assert.equal(
    isDiscoveredLate(
      new Date("2026-04-21T03:00:00.000Z"),
      releaseDate,
      "America/Los_Angeles",
    ),
    false,
  );
});
