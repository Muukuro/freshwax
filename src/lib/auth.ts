import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function ensureUserScaffold(userId: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  await prisma.calendarToken.upsert({
    where: { userId },
    update: {},
    create: { userId, token: randomBytes(24).toString("hex") },
  });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          settings: true,
          calendarToken: true,
          deezerConnection: true,
          lastfmConnection: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { token } });
    }
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
