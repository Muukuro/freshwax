import { prisma } from "@/lib/db";
import { buildCalendarFeed } from "@/lib/calendar";
import { buildReleaseTypeFilter, filterReleasesForSettings } from "@/lib/data";
import { buildReleasePlatformLinks } from "@/lib/platform-links";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import {
  getDateOffsetUtcDateForTimeZone,
  getTodayUtcDateForTimeZone,
} from "@/lib/timezone";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const calendarToken = await prisma.calendarToken.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          settings: true,
          platformPreferences: true,
        },
      },
    },
  });

  if (!calendarToken) {
    return new Response("Not found", { status: 404 });
  }

  const settings = calendarToken.user.settings;
  const timeZone = getEffectiveTimeZone(calendarToken.user.timezone);
  const today = getTodayUtcDateForTimeZone(timeZone);
  const horizon = getDateOffsetUtcDateForTimeZone(timeZone, settings?.futureHorizonDays ?? 180);
  const releases = await prisma.release.findMany({
    where: {
      releaseDate: {
        gte: today,
        lte: horizon,
      },
      type: settings ? buildReleaseTypeFilter(settings) : undefined,
      artists: {
        some: {
          artist: {
            followers: {
              some: { userId: calendarToken.userId },
            },
          },
        },
      },
      ignoredBy: settings?.hideIgnored ? { none: { userId: calendarToken.userId } } : undefined,
    },
    include: {
      artists: {
        include: {
          artist: {
            include: {
              mappings: true,
            },
          },
        },
      },
      mappings: true,
    },
    orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
  });
  const filteredReleases = filterReleasesForSettings(releases, settings ?? {}).map((release) => ({
    ...release,
    platformLinks: buildReleasePlatformLinks({
      artistName: release.artists[0]?.artist.canonicalName ?? "Unknown Artist",
      releaseTitle: release.title,
      mappings: release.mappings,
      preferences: calendarToken.user.platformPreferences,
    }),
  }));

  const ics = buildCalendarFeed(filteredReleases, token, `${calendarToken.user.name} releases`);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "Content-Disposition": `inline; filename="${calendarToken.user.name
        .toLowerCase()
        .replace(/\s+/g, "-")}-releases.ics"`,
    },
  });
}
