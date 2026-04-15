import { prisma } from "@/lib/db";
import { buildCalendarFeed } from "@/lib/calendar";
import { buildReleaseTypeFilter } from "@/lib/data";
import { horizonDate } from "@/lib/utils";

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
        },
      },
    },
  });

  if (!calendarToken) {
    return new Response("Not found", { status: 404 });
  }

  const settings = calendarToken.user.settings;
  const releases = await prisma.release.findMany({
    where: {
      releaseDate: {
        gte: new Date(),
        lte: horizonDate(settings?.futureHorizonDays ?? 180),
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
          artist: true,
        },
      },
    },
    orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
  });

  const ics = buildCalendarFeed(releases, token, `${calendarToken.user.name} releases`);

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
