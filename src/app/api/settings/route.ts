import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { isValidTimeZone } from "@/lib/timezone";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    timezone: getEffectiveTimeZone(user.timezone),
    settings: user.settings,
    calendarToken: user.calendarToken,
    platformPreferences: user.platformPreferences,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    timezone?: string;
    futureHorizonDays?: number;
    discoveryWindowDays?: number;
  };
  const timeZone = body.timezone?.trim();

  if (timeZone && !isValidTimeZone(timeZone)) {
    return Response.json({ error: "Choose a valid timezone" }, { status: 400 });
  }

  const settings = await prisma.userSettings.update({
    where: { userId: user.id },
    data: {
      futureHorizonDays: body.futureHorizonDays,
      discoveryWindowDays: body.discoveryWindowDays,
    },
  });

  if (timeZone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { timezone: timeZone },
    });
  }

  return Response.json({
    ...settings,
    timezone: timeZone ?? getEffectiveTimeZone(user.timezone),
  });
}
