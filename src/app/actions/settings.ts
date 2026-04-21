"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Provider } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  STREAMING_PROVIDERS,
  getDefaultProviderPreference,
} from "@/lib/platforms";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { isValidTimeZone } from "@/lib/timezone";

function parseTimeZone(value: FormDataEntryValue | null, fallbackTimeZone: string) {
  const timeZone = String(value ?? fallbackTimeZone).trim();

  if (!isValidTimeZone(timeZone)) {
    throw new Error("Choose a valid timezone");
  }

  return timeZone;
}

function parseLastfmImportMinPlaycount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Last.fm minimum listens must be at least 1");
  }

  return Math.floor(parsed);
}

async function savePlatformPreferences(userId: string, formData: FormData) {
  const submittedProviders = STREAMING_PROVIDERS.filter((provider) =>
    ["favorite", "allowImport", "showArtistLinks", "showReleaseLinks", "favoriteRank"].some((field) =>
      formData.has(`${field}:${provider}`),
    ),
  );

  if (submittedProviders.length === 0) {
    return;
  }

  const existingPreferences = await prisma.userPlatformPreference.findMany({
    where: {
      userId,
      provider: {
        in: submittedProviders,
      },
    },
  });
  const existingByProvider = new Map(existingPreferences.map((preference) => [preference.provider, preference]));
  const isChecked = (key: string) => formData.getAll(key).some((value) => value === "on");

  for (const provider of submittedProviders) {
    const index = STREAMING_PROVIDERS.indexOf(provider);
    const defaults = getDefaultProviderPreference(provider);
    const existing = existingByProvider.get(provider);
    const allowImport = formData.has(`allowImport:${provider}`)
      ? isChecked(`allowImport:${provider}`)
      : existing?.allowImport ?? defaults.allowImport;
    const showArtistLinks = formData.has(`showArtistLinks:${provider}`)
      ? isChecked(`showArtistLinks:${provider}`)
      : existing?.showArtistLinks ?? defaults.showArtistLinks;
    const showReleaseLinks = formData.has(`showReleaseLinks:${provider}`)
      ? isChecked(`showReleaseLinks:${provider}`)
      : existing?.showReleaseLinks ?? defaults.showReleaseLinks;
    const isFavorite = formData.has(`favorite:${provider}`)
      ? isChecked(`favorite:${provider}`)
      : existing?.isFavorite ?? defaults.isFavorite;
    const favoriteRankValue =
      formData.get(`favoriteRank:${provider}`) ?? existing?.favoriteRank ?? index + 1;

    await prisma.userPlatformPreference.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        allowImport,
        showArtistLinks,
        showReleaseLinks,
        isFavorite,
        favoriteRank: isFavorite ? Number(favoriteRankValue) : null,
      },
      create: {
        userId,
        provider,
        allowImport,
        showArtistLinks,
        showReleaseLinks,
        isFavorite,
        favoriteRank: isFavorite ? Number(favoriteRankValue) : null,
      },
    });
  }
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  const timeZone = parseTimeZone(formData.get("timezone"), getEffectiveTimeZone(user.timezone));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: timeZone,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      includeSingles: formData.get("includeSingles") === "on",
      includeEps: formData.get("includeEps") === "on",
      includeCompilations: formData.get("includeCompilations") === "on",
      includeLive: formData.get("includeLive") === "on",
      includeReissues: formData.get("includeReissues") === "on",
      hideClassicalComposerAppearances: formData.get("hideClassicalComposerAppearances") === "on",
      hideIgnored: formData.get("hideIgnored") === "on",
      futureHorizonDays: Number(formData.get("futureHorizonDays") ?? 180),
      discoveryWindowDays: Number(formData.get("discoveryWindowDays") ?? 30),
    },
    create: {
      userId: user.id,
      includeSingles: formData.get("includeSingles") === "on",
      includeEps: formData.get("includeEps") === "on",
      includeCompilations: formData.get("includeCompilations") === "on",
      includeLive: formData.get("includeLive") === "on",
      includeReissues: formData.get("includeReissues") === "on",
      hideClassicalComposerAppearances: formData.get("hideClassicalComposerAppearances") === "on",
      hideIgnored: formData.get("hideIgnored") === "on",
      futureHorizonDays: Number(formData.get("futureHorizonDays") ?? 180),
      discoveryWindowDays: Number(formData.get("discoveryWindowDays") ?? 30),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function updateNotificationSettingsAction(formData: FormData) {
  const user = await requireUser();

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      notifyOnReleaseDay: formData.get("notifyOnReleaseDay") === "on",
      notifyOnDiscovery: formData.get("notifyOnDiscovery") === "on",
    },
    create: {
      userId: user.id,
      notifyOnReleaseDay: formData.get("notifyOnReleaseDay") === "on",
      notifyOnDiscovery: formData.get("notifyOnDiscovery") === "on",
    },
  });

  revalidatePath("/settings");
}

export async function updatePlatformPreferencesAction(formData: FormData) {
  const user = await requireUser();

  await savePlatformPreferences(user.id, formData);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function completeOnboardingAction(formData: FormData) {
  const user = await requireUser();
  const timeZone = parseTimeZone(formData.get("timezone"), getEffectiveTimeZone(user.timezone));

  await savePlatformPreferences(user.id, formData);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: timeZone,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      includeSingles: formData.get("includeSingles") === "on",
      includeEps: formData.get("includeEps") === "on",
      includeCompilations: formData.get("includeCompilations") === "on",
      includeLive: formData.get("includeLive") === "on",
      includeReissues: formData.get("includeReissues") === "on",
    },
    create: {
      userId: user.id,
      includeSingles: formData.get("includeSingles") === "on",
      includeEps: formData.get("includeEps") === "on",
      includeCompilations: formData.get("includeCompilations") === "on",
      includeLive: formData.get("includeLive") === "on",
      includeReissues: formData.get("includeReissues") === "on",
    },
  });

  revalidatePath("/onboarding");
  redirect("/dashboard");
}

export async function rotateCalendarTokenAction() {
  const user = await requireUser();

  await prisma.calendarToken.upsert({
    where: { userId: user.id },
    update: {
      token: randomBytes(24).toString("hex"),
      lastRotatedAt: new Date(),
    },
    create: {
      userId: user.id,
      token: randomBytes(24).toString("hex"),
    },
  });

  revalidatePath("/settings");
}

export async function disconnectDeezerAction() {
  const user = await requireUser();

  await prisma.deezerConnection.deleteMany({
    where: { userId: user.id },
  });

  revalidatePath("/settings");
  revalidatePath("/artists");
}

export async function disconnectSpotifyAction() {
  const user = await requireUser();

  await prisma.spotifyConnection.deleteMany({
    where: { userId: user.id },
  });
  await prisma.externalIdentity.deleteMany({
    where: { userId: user.id, provider: Provider.SPOTIFY },
  });

  revalidatePath("/settings");
}

export async function disconnectTidalAction() {
  const user = await requireUser();

  await prisma.tidalConnection.deleteMany({
    where: { userId: user.id },
  });
  await prisma.externalIdentity.deleteMany({
    where: { userId: user.id, provider: Provider.TIDAL },
  });

  revalidatePath("/settings");
}

export async function disconnectAppleMusicAction() {
  const user = await requireUser();

  await prisma.appleMusicConnection.deleteMany({
    where: { userId: user.id },
  });
  await prisma.externalIdentity.deleteMany({
    where: { userId: user.id, provider: Provider.APPLE_MUSIC },
  });

  revalidatePath("/settings");
}

export async function saveLastfmUsernameAction(formData: FormData) {
  const user = await requireUser();
  const lastfmUserName = String(formData.get("lastfmUserName") ?? "").trim();
  const importMinPlaycount = parseLastfmImportMinPlaycount(formData.get("importMinPlaycount"));

  if (!lastfmUserName) {
    throw new Error("Enter a Last.fm username");
  }

  await prisma.lastfmConnection.upsert({
    where: { userId: user.id },
    update: {
      lastfmUserName,
      importMinPlaycount,
    },
    create: {
      userId: user.id,
      lastfmUserName,
      importMinPlaycount,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/artists");
}

export async function disconnectLastfmAction() {
  const user = await requireUser();

  await prisma.lastfmConnection.deleteMany({
    where: { userId: user.id },
  });

  revalidatePath("/settings");
  revalidatePath("/artists");
}
