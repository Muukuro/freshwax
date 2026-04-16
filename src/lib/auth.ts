import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Provider } from "@prisma/client";

import { prisma } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { STREAMING_PROVIDERS, getDefaultProviderPreference } from "@/lib/platforms";

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

  await prisma.userPlatformPreference.createMany({
    data: STREAMING_PROVIDERS.map((provider) => ({
      userId,
      ...getDefaultProviderPreference(provider),
    })),
    skipDuplicates: true,
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
    select: {
      id: true,
      expiresAt: true,
      userId: true,
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  await ensureUserScaffold(session.userId);

  return prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      settings: true,
      calendarToken: true,
      deezerConnection: true,
      spotifyConnection: true,
      tidalConnection: true,
      appleMusicConnection: true,
      lastfmConnection: true,
      platformPreferences: {
        orderBy: [{ favoriteRank: "asc" }, { provider: "asc" }],
      },
      externalIdentities: true,
    },
  });
}

export async function getPostAuthRedirect(userId: string) {
  const [followCount, user] = await Promise.all([
    prisma.userFollow.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompletedAt: true,
      },
    }),
  ]);

  if (!user?.onboardingCompletedAt || followCount === 0) {
    return "/onboarding";
  }

  return "/dashboard";
}

export async function requireOnboardedUser() {
  const user = await requireUser();
  const followCount = await prisma.userFollow.count({
    where: { userId: user.id },
  });

  if (!user.onboardingCompletedAt || followCount === 0) {
    redirect("/onboarding");
  }

  return user;
}

export async function createExternalIdentityUser(input: {
  provider: Provider;
  providerUserId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const existingIdentity = await prisma.externalIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    include: {
      user: true,
    },
  });

  if (existingIdentity) {
    await prisma.externalIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        email: input.email,
        displayName: input.displayName ?? existingIdentity.displayName,
        avatarUrl: input.avatarUrl ?? existingIdentity.avatarUrl,
      },
    });

    return existingIdentity.user;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new Error("Account merge confirmation required");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.displayName?.trim() || input.email.split("@")[0] || "Freshwax listener",
      externalIdentities: {
        create: {
          provider: input.provider,
          providerUserId: input.providerUserId,
          email: input.email,
          displayName: input.displayName ?? null,
          avatarUrl: input.avatarUrl ?? null,
        },
      },
    },
  });

  await ensureUserScaffold(user.id);
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
