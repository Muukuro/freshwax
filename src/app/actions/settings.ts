"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Provider } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STREAMING_PROVIDERS, getDefaultProviderPreference } from "@/lib/platforms";

function parseLastfmImportMinPlaycount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Last.fm minimum listens must be at least 1");
  }

  return Math.floor(parsed);
}

async function savePlatformPreferences(userId: string, formData: FormData) {
  for (const [index, provider] of STREAMING_PROVIDERS.entries()) {
    const defaults = getDefaultProviderPreference(provider);
    const allowImport = formData.get(`allowImport:${provider}`) === "on";
    const showArtistLinks = formData.get(`showArtistLinks:${provider}`) === "on";
    const showReleaseLinks = formData.get(`showReleaseLinks:${provider}`) === "on";
    const isFavorite = formData.get(`favorite:${provider}`) === "on";

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
        favoriteRank:
          isFavorite
            ? Number(formData.get(`favoriteRank:${provider}`) ?? index + 1)
            : null,
      },
      create: {
        userId,
        provider,
        allowImport: formData.has(`allowImport:${provider}`) ? allowImport : defaults.allowImport,
        showArtistLinks: formData.has(`showArtistLinks:${provider}`)
          ? showArtistLinks
          : defaults.showArtistLinks,
        showReleaseLinks: formData.has(`showReleaseLinks:${provider}`)
          ? showReleaseLinks
          : defaults.showReleaseLinks,
        isFavorite: formData.has(`favorite:${provider}`) ? isFavorite : defaults.isFavorite,
        favoriteRank:
          isFavorite
            ? Number(formData.get(`favoriteRank:${provider}`) ?? index + 1)
            : defaults.favoriteRank,
      },
    });
  }
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: String(formData.get("timezone") ?? "UTC"),
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

  await savePlatformPreferences(user.id, formData);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function completeOnboardingAction(formData: FormData) {
  const user = await requireUser();

  await savePlatformPreferences(user.id, formData);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: String(formData.get("timezone") ?? user.timezone ?? "UTC"),
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
