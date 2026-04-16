"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { enqueueArtistSync, enqueueGlobalSync } from "@/lib/queue";
import {
  followArtistForUser,
  importDeezerFollowedArtistsForUser,
  importLastfmTopArtistsForUser,
  syncArtist,
  unfollowArtistForUser,
} from "@/lib/sync";
import { isDeezerOAuthConfigured, searchArtists } from "@/lib/providers/deezer";
import { isLastfmConfigured } from "@/lib/providers/lastfm";
import { prisma } from "@/lib/db";

export async function followArtistAction(formData: FormData) {
  const user = await requireUser();
  const providerArtistId = String(formData.get("providerArtistId") ?? "");
  const query = String(formData.get("query") ?? "");

  const results = await searchArtists(query);
  const match = results.find((entry) => entry.providerArtistId === providerArtistId);

  if (!match) {
    throw new Error("Artist search result could not be resolved");
  }

  const artist = await followArtistForUser(user.id, match);
  await enqueueArtistSync(artist.id);
  void syncArtist(artist.id, user.id).catch(() => undefined);

  revalidatePath("/artists");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function unfollowArtistAction(formData: FormData) {
  const user = await requireUser();
  const artistId = String(formData.get("artistId") ?? "");

  await unfollowArtistForUser(user.id, artistId);

  revalidatePath("/artists");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function importDeezerFollowsAction() {
  const user = await requireUser();

  if (!isDeezerOAuthConfigured()) {
    throw new Error("Deezer OAuth is not configured");
  }

  const connection = await prisma.deezerConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    throw new Error("Connect your Deezer account before importing artists");
  }

  if (connection.expiresAt && connection.expiresAt <= new Date()) {
    throw new Error("Your Deezer connection has expired. Reconnect the account and try again.");
  }

  await importDeezerFollowedArtistsForUser(user.id, connection.accessToken);

  await prisma.deezerConnection.update({
    where: { userId: user.id },
    data: {
      lastImportedAt: new Date(),
    },
  });

  revalidatePath("/artists");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function importLastfmArtistsAction() {
  const user = await requireUser();

  if (!isLastfmConfigured()) {
    throw new Error("Last.fm import is not configured");
  }

  const connection = await prisma.lastfmConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    throw new Error("Save your Last.fm username before importing artists");
  }

  await importLastfmTopArtistsForUser(
    user.id,
    connection.lastfmUserName,
    connection.importMinPlaycount,
  );

  await prisma.lastfmConnection.update({
    where: { userId: user.id },
    data: {
      lastImportedAt: new Date(),
    },
  });

  revalidatePath("/artists");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
}

export async function ignoreReleaseAction(formData: FormData) {
  const user = await requireUser();
  const releaseId = String(formData.get("releaseId") ?? "");

  await prisma.ignoredRelease.upsert({
    where: {
      userId_releaseId: {
        userId: user.id,
        releaseId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      releaseId,
    },
  });

  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
  revalidatePath("/dashboard");
}

export async function unignoreReleaseAction(formData: FormData) {
  const user = await requireUser();
  const releaseId = String(formData.get("releaseId") ?? "");

  await prisma.ignoredRelease.deleteMany({
    where: {
      userId: user.id,
      releaseId,
    },
  });

  revalidatePath("/upcoming");
  revalidatePath("/discoveries");
  revalidatePath("/dashboard");
}

export async function triggerGlobalSyncAction() {
  const user = await requireUser();
  await enqueueGlobalSync();
  await prisma.syncJob.create({
    data: {
      kind: "SYNC_ALL_ARTISTS",
      status: "PENDING",
      userId: user.id,
      message: "Queued a full sync",
    },
  });
  revalidatePath("/dashboard");
}
