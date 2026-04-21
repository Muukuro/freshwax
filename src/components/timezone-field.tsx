"use client";

import { LocateFixed, Search } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";

import {
  getFallbackTimeZones,
  getSupportedTimeZones,
  isValidTimeZone,
} from "@/lib/timezone";

function getBrowserTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
}

export function TimezoneField({
  defaultValue,
  name,
}: {
  defaultValue: string;
  name: string;
}) {
  const [filter, setFilter] = useState("");
  const [selectedTimeZone, setSelectedTimeZone] = useState(defaultValue);
  const [supportedTimeZones] = useState(() => {
    const timeZones = getSupportedTimeZones();
    return timeZones.length > 0 ? timeZones : getFallbackTimeZones();
  });
  const deferredFilter = useDeferredValue(filter);
  const browserTimeZone = getBrowserTimeZone();
  const searchId = useId();
  const selectId = useId();

  const normalizedFilter = deferredFilter.trim().toLowerCase();
  const filteredTimeZones = normalizedFilter
    ? supportedTimeZones.filter((timeZone) => timeZone.toLowerCase().includes(normalizedFilter))
    : supportedTimeZones;
  const visibleTimeZones = filteredTimeZones.includes(selectedTimeZone)
    ? filteredTimeZones
    : [selectedTimeZone, ...filteredTimeZones];

  return (
    <div className="field gap-3">
      <span>Timezone</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          aria-controls={selectId}
          className="timezone-search-input"
          id={searchId}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search timezones"
          style={{ paddingLeft: "3rem", paddingRight: "1rem" }}
          type="text"
          value={filter}
        />
      </div>
      <select
        id={selectId}
        name={name}
        onChange={(event) => setSelectedTimeZone(event.target.value)}
        value={selectedTimeZone}
      >
        {visibleTimeZones.map((timeZone) => (
          <option key={timeZone} value={timeZone}>
            {timeZone}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-6 text-[var(--muted)]">
        <p>
          This controls Freshwax&apos;s idea of today, recent-release windows, calendar filtering, and
          local timestamp labels.
        </p>
        {browserTimeZone ? (
          <button
            className="ghost-button px-3 py-2"
            onClick={() => {
              setSelectedTimeZone(browserTimeZone);
              setFilter(browserTimeZone);
            }}
            type="button"
          >
            <LocateFixed className="h-4 w-4" />
            Use browser timezone
          </button>
        ) : null}
      </div>
      {filteredTimeZones.length === 0 ? (
        <p className="text-xs text-amber-200">
          No timezones match this search. Try a region or city name, like Amsterdam or New York.
        </p>
      ) : null}
    </div>
  );
}
