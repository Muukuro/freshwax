"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  mergeDuplicateReleasesForUser,
  ReleaseMergeError,
} from "@/lib/release-duplicates";

export async function mergeDuplicateReleaseAction(formData: FormData) {
  const user = await requireUser();
  const survivingReleaseId = String(
    formData.get("survivingReleaseId") ?? "",
  );
  const duplicateReleaseId = String(formData.get("duplicateReleaseId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!survivingReleaseId || !duplicateReleaseId) {
    throw new ReleaseMergeError("Choose both releases before merging");
  }
  if (confirmation !== "merge") {
    throw new ReleaseMergeError("Confirm the duplicate merge");
  }

  const affectedArtists = await prisma.releaseArtist.findMany({
    where: {
      releaseId: { in: [survivingReleaseId, duplicateReleaseId] },
    },
    select: { artistId: true },
    distinct: ["artistId"],
  });
  const calendarToken = await prisma.calendarToken.findUnique({
    where: { userId: user.id },
    select: { token: true },
  });

  await mergeDuplicateReleasesForUser({
    userId: user.id,
    survivingReleaseId,
    duplicateReleaseId,
  });

  revalidatePath(`/releases/${survivingReleaseId}`);
  revalidatePath(`/releases/${duplicateReleaseId}`);
  for (const { artistId } of affectedArtists) {
    revalidatePath(`/artists/${artistId}`);
  }
  revalidatePath("/artists");
  revalidatePath("/dashboard");
  revalidatePath("/recent");
  revalidatePath("/upcoming");
  if (calendarToken) {
    revalidatePath(`/calendar/${calendarToken.token}.ics`);
  }

  redirect(
    `/releases/${survivingReleaseId}?duplicate=merged`,
    RedirectType.replace,
  );
}
