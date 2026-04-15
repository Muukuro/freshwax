import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  exchangeDeezerCodeForToken,
  fetchCurrentDeezerUser,
} from "@/lib/providers/deezer";

const DEEZER_STATE_COOKIE = "nrt_deezer_oauth_state";

function redirectToSettings(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/settings?deezer=${status}`, request.url));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const errorReason =
    url.searchParams.get("error_reason") ?? url.searchParams.get("error") ?? null;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DEEZER_STATE_COOKIE)?.value;

  cookieStore.delete(DEEZER_STATE_COOKIE);

  if (errorReason) {
    return redirectToSettings(request, "denied");
  }

  if (!state || !expectedState || state !== expectedState) {
    return redirectToSettings(request, "state-mismatch");
  }

  if (!code) {
    return redirectToSettings(request, "missing-code");
  }

  try {
    const token = await exchangeDeezerCodeForToken(code);
    const deezerUser = await fetchCurrentDeezerUser(token.accessToken);
    const existingConnection = await prisma.deezerConnection.findUnique({
      where: { deezerUserId: deezerUser.deezerUserId },
    });

    if (existingConnection && existingConnection.userId !== user.id) {
      return redirectToSettings(request, "already-linked");
    }

    await prisma.deezerConnection.upsert({
      where: { userId: user.id },
      update: {
        deezerUserId: deezerUser.deezerUserId,
        deezerUserName: deezerUser.deezerUserName,
        accessToken: token.accessToken,
        expiresAt:
          token.expiresIn && Number.isFinite(token.expiresIn)
            ? new Date(Date.now() + token.expiresIn * 1000)
            : null,
      },
      create: {
        userId: user.id,
        deezerUserId: deezerUser.deezerUserId,
        deezerUserName: deezerUser.deezerUserName,
        accessToken: token.accessToken,
        expiresAt:
          token.expiresIn && Number.isFinite(token.expiresIn)
            ? new Date(Date.now() + token.expiresIn * 1000)
            : null,
      },
    });

    return redirectToSettings(request, "connected");
  } catch {
    return redirectToSettings(request, "error");
  }
}
