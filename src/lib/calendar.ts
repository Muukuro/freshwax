import { format } from "date-fns";

import { absoluteUrl, releaseTypeLabel } from "@/lib/utils";
import { type PlatformLinkEntry } from "@/lib/data";

type CalendarRelease = {
  id: string;
  title: string;
  releaseDate: Date;
  type: string;
  platformLinks?: PlatformLinkEntry[];
  artists: { artist: { canonicalName: string } }[];
};

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildCalendarFeed(
  releases: CalendarRelease[],
  token: string,
  appName = "Freshwax",
) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Freshwax//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(appName)}`,
    `X-WR-CALDESC:${escapeIcs("Upcoming music releases from followed artists")}`,
  ];

  for (const release of releases) {
    const artistNames = release.artists.map((entry) => entry.artist.canonicalName).join(", ");
    const description = [
      `Artist: ${artistNames}`,
      `Type: ${releaseTypeLabel(release.type)}`,
      ...(release.platformLinks ?? []).map((link) => `${link.label}: ${link.href}`),
      `Open in app: ${absoluteUrl("/upcoming")}`,
    ]
      .filter(Boolean)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:release-${release.id}-${token}@new-release-tracker`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${format(release.releaseDate, "yyyyMMdd")}`,
      `SUMMARY:${escapeIcs(`${artistNames} — ${release.title}`)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}
