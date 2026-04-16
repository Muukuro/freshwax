"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseLastfmImportMinPlaycount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Last.fm minimum listens must be at least 1");
  }

  return Math.floor(parsed);
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
