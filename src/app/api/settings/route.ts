import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    timezone: user.timezone,
    settings: user.settings,
    calendarToken: user.calendarToken,
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

  const settings = await prisma.userSettings.update({
    where: { userId: user.id },
    data: {
      futureHorizonDays: body.futureHorizonDays,
      discoveryWindowDays: body.discoveryWindowDays,
    },
  });

  if (body.timezone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { timezone: body.timezone },
    });
  }

  return Response.json(settings);
}
