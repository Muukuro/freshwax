"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  removeManualArtistProviderMapping,
  removeManualReleaseProviderMapping,
  setManualArtistProviderMapping,
  setManualReleaseProviderMapping,
} from "@/lib/provider-mapping-corrections";
import { enqueueArtistSync } from "@/lib/queue";
import { syncArtist } from "@/lib/sync";

async function requireFollowedArtist(userId: string, artistId: string) {
  const follow = await prisma.userFollow.findUnique({
    where: {
      userId_artistId: {
        userId,
        artistId,
      },
    },
    select: { artistId: true },
  });

  if (!follow) {
    throw new Error("Artist is not followed by the current user");
  }
}

async function requireVisibleRelease(userId: string, releaseId: string) {
  const release = await prisma.release.findFirst({
    where: {
      id: releaseId,
      artists: {
        some: {
          artist: {
            followers: {
              some: { userId },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!release) {
    throw new Error("Release is not visible to the current user");
  }
}

function providerFromForm(formData: FormData) {
  return String(formData.get("provider") ?? "").trim();
}

function valueFromForm(formData: FormData) {
  return String(formData.get("providerValue") ?? "").trim();
}

export async function saveArtistProviderMappingAction(formData: FormData) {
  const user = await requireUser();
  const artistId = String(formData.get("artistId") ?? "").trim();

  await requireFollowedArtist(user.id, artistId);
  await setManualArtistProviderMapping({
    artistId,
    provider: providerFromForm(formData),
    value: valueFromForm(formData),
  });

  await enqueueArtistSync(artistId);
  after(async () => {
    await syncArtist(artistId, user.id);
    revalidatePath(`/artists/${artistId}`);
    revalidatePath("/artists");
    revalidatePath("/dashboard");
    revalidatePath("/recent");
    revalidatePath("/upcoming");
  });

  revalidatePath(`/artists/${artistId}`);
  revalidatePath("/artists");
  revalidatePath("/dashboard");
  revalidatePath("/recent");
  revalidatePath("/upcoming");
}

export async function removeArtistProviderMappingAction(formData: FormData) {
  const user = await requireUser();
  const artistId = String(formData.get("artistId") ?? "").trim();

  await requireFollowedArtist(user.id, artistId);
  await removeManualArtistProviderMapping({
    artistId,
    provider: providerFromForm(formData),
  });

  revalidatePath(`/artists/${artistId}`);
  revalidatePath("/artists");
  revalidatePath("/dashboard");
  revalidatePath("/recent");
  revalidatePath("/upcoming");
}

export async function saveReleaseProviderMappingAction(formData: FormData) {
  const user = await requireUser();
  const releaseId = String(formData.get("releaseId") ?? "").trim();

  await requireVisibleRelease(user.id, releaseId);
  await setManualReleaseProviderMapping({
    releaseId,
    provider: providerFromForm(formData),
    value: valueFromForm(formData),
  });

  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/recent");
  revalidatePath("/upcoming");
}

export async function removeReleaseProviderMappingAction(formData: FormData) {
  const user = await requireUser();
  const releaseId = String(formData.get("releaseId") ?? "").trim();

  await requireVisibleRelease(user.id, releaseId);
  await removeManualReleaseProviderMapping({
    releaseId,
    provider: providerFromForm(formData),
  });

  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/recent");
  revalidatePath("/upcoming");
}
