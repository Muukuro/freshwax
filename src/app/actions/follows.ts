"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Provider } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { enqueueArtistSync } from "@/lib/queue";
import { clearImportCancellation } from "@/lib/queue";
import {
  followArtistForUser,
  importDeezerFollowedArtistsForUser,
  importLastfmTopArtistsForUser,
  importTidalFollowedArtistsForUser,
  syncArtist,
  unfollowArtistForUser,
} from "@/lib/sync";
import { isDeezerOAuthConfigured } from "@/lib/providers/deezer";
import { isLastfmConfigured } from "@/lib/providers/lastfm";
import { prisma } from "@/lib/db";

export async function followArtistAction(formData: FormData) {
  const user = await requireUser();
  const musicbrainzArtistId = String(formData.get("musicbrainzArtistId") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const providerArtistId = String(formData.get("providerArtistId") ?? "").trim();
  const providerUrl = String(formData.get("providerUrl") ?? "").trim();
  const sourceProviderRaw = String(formData.get("sourceProvider") ?? "").trim();
  const sourceProvider = sourceProviderRaw
    ? (Provider[sourceProviderRaw as keyof typeof Provider] ?? sourceProviderRaw)
    : undefined;

  if (!artistName) {
    throw new Error("Artist search result could not be resolved");
  }

  if (!musicbrainzArtistId) {
    throw new Error("Artist search result did not resolve to a canonical MusicBrainz artist");
  }

  const artist = await followArtistForUser(user.id, {
    musicbrainzArtistId,
    name: artistName,
    sourceProvider: sourceProvider as Provider | undefined,
    providerArtistId: providerArtistId || null,
    providerUrl: providerUrl || null,
    imageUrl: null,
    deezerFans: null,
  });
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

export async function syncFollowedArtistNowAction(formData: FormData) {
  const user = await requireUser();
  const artistId = String(formData.get("artistId") ?? "");

  const follow = await prisma.userFollow.findUnique({
    where: {
      userId_artistId: {
        userId: user.id,
        artistId,
      },
    },
    select: { artistId: true },
  });

  if (!follow) {
    throw new Error("Artist is not followed by the current user");
  }

  after(async () => {
    await syncArtist(artistId, user.id);
    revalidatePath("/artists");
    revalidatePath("/dashboard");
    revalidatePath("/upcoming");
    revalidatePath("/discoveries");
  });

  revalidatePath("/artists");
}

export type ImportResult =
  | { ok: true; started: true }
  | { ok: false; error: string };

export async function importDeezerFollowsAction(
  _prevState: ImportResult | null,
  _formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();

  if (!isDeezerOAuthConfigured()) {
    return { ok: false, error: "Deezer OAuth is not configured" };
  }

  const connection = await prisma.deezerConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    return { ok: false, error: "Connect your Deezer account before importing artists" };
  }

  if (connection.expiresAt && connection.expiresAt <= new Date()) {
    return { ok: false, error: "Your Deezer connection has expired. Reconnect the account and try again." };
  }

  await clearImportCancellation(user.id);

  after(async () => {
    await importDeezerFollowedArtistsForUser(user.id, connection.accessToken);
    await prisma.deezerConnection.update({
      where: { userId: user.id },
      data: { lastImportedAt: new Date() },
    });
    revalidatePath("/artists");
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/upcoming");
    revalidatePath("/discoveries");
  });

  return { ok: true, started: true };
}

export async function importTidalFollowsAction(
  _prevState: ImportResult | null,
  _formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();

  const connection = await prisma.tidalConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    return { ok: false, error: "Connect your TIDAL account before importing artists" };
  }

  if (connection.expiresAt && connection.expiresAt <= new Date()) {
    return { ok: false, error: "Your TIDAL connection has expired. Reconnect the account and try again." };
  }

  await clearImportCancellation(user.id);

  after(async () => {
    await importTidalFollowedArtistsForUser(user.id, connection.accessToken);
    await prisma.tidalConnection.update({
      where: { userId: user.id },
      data: { lastImportedAt: new Date() },
    });
    revalidatePath("/artists");
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/upcoming");
    revalidatePath("/discoveries");
  });

  return { ok: true, started: true };
}

export async function importLastfmArtistsAction(
  _prevState: ImportResult | null,
  _formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();

  if (!isLastfmConfigured()) {
    return { ok: false, error: "Last.fm import is not configured" };
  }

  const connection = await prisma.lastfmConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    return { ok: false, error: "Save your Last.fm username before importing artists" };
  }

  await clearImportCancellation(user.id);

  after(async () => {
    await importLastfmTopArtistsForUser(
      user.id,
      connection.lastfmUserName,
      connection.importMinPlaycount,
    );
    await prisma.lastfmConnection.update({
      where: { userId: user.id },
      data: { lastImportedAt: new Date() },
    });
    revalidatePath("/artists");
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/upcoming");
    revalidatePath("/discoveries");
  });

  return { ok: true, started: true };
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
