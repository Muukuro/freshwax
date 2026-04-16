import { cookies } from "next/headers";
import { Provider } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  completeExternalAuth,
  getProviderSlug,
  getPkceCookieName,
  providerFromSlug,
} from "@/lib/external-auth";
import {
  createExternalIdentityUser,
  createSession,
  ensureUserScaffold,
  getCurrentUser,
  getPostAuthRedirect,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

function redirectWithError(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/login?error=${status}`, request.url));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerSlug } = await context.params;
  const provider = providerFromSlug(providerSlug);

  if (!provider) {
    return redirectWithError(request, "provider");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(`freshwax_${getProviderSlug(provider)}_oauth_state`)?.value;
  const pkceVerifier = cookieStore.get(getPkceCookieName(provider))?.value;
  cookieStore.delete(`freshwax_${getProviderSlug(provider)}_oauth_state`);
  cookieStore.delete(getPkceCookieName(provider));

  if (error) {
    return redirectWithError(request, "provider-denied");
  }

  if (!code) {
    return redirectWithError(request, "provider-missing-code");
  }

  if (!stateCookie || !returnedState || stateCookie !== returnedState) {
    return redirectWithError(request, "provider-state");
  }

  try {
    const profile = await completeExternalAuth(provider, code, {
      codeVerifier: pkceVerifier,
    });
    const currentUser = await getCurrentUser();

    if (currentUser) {
      const existingIdentity = await prisma.externalIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: profile.providerUserId,
          },
        },
      });

      if (existingIdentity && existingIdentity.userId !== currentUser.id) {
        return redirectWithError(request, "provider-link-required");
      }

      await prisma.externalIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: profile.providerUserId,
          },
        },
        update: {
          userId: currentUser.id,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
        create: {
          userId: currentUser.id,
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      });

      if (provider === Provider.SPOTIFY && profile.accessToken) {
        await prisma.spotifyConnection.upsert({
          where: { userId: currentUser.id },
          update: {
            spotifyUserId: profile.providerUserId,
            spotifyUserName: profile.displayName,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken ?? null,
            expiresAt: profile.expiresAt ?? null,
          },
          create: {
            userId: currentUser.id,
            spotifyUserId: profile.providerUserId,
            spotifyUserName: profile.displayName,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken ?? null,
            expiresAt: profile.expiresAt ?? null,
          },
        });
      }

      if (provider === Provider.TIDAL && profile.accessToken) {
        await prisma.tidalConnection.upsert({
          where: { userId: currentUser.id },
          update: {
            tidalUserId: profile.providerUserId,
            tidalUserName: profile.displayName,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken ?? null,
            expiresAt: profile.expiresAt ?? null,
          },
          create: {
            userId: currentUser.id,
            tidalUserId: profile.providerUserId,
            tidalUserName: profile.displayName,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken ?? null,
            expiresAt: profile.expiresAt ?? null,
          },
        });
      }

      if (provider === Provider.DEEZER && profile.accessToken) {
        await prisma.deezerConnection.upsert({
          where: { userId: currentUser.id },
          update: {
            deezerUserId: profile.providerUserId,
            deezerUserName: profile.displayName,
            accessToken: profile.accessToken,
            expiresAt: profile.expiresAt ?? null,
          },
          create: {
            userId: currentUser.id,
            deezerUserId: profile.providerUserId,
            deezerUserName: profile.displayName,
            accessToken: profile.accessToken,
            expiresAt: profile.expiresAt ?? null,
          },
        });
      }

      return NextResponse.redirect(new URL("/settings", request.url));
    }

    const user = await createExternalIdentityUser({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    await ensureUserScaffold(user.id);

    if (provider === Provider.SPOTIFY && profile.accessToken) {
      await prisma.spotifyConnection.upsert({
        where: { userId: user.id },
        update: {
          spotifyUserId: profile.providerUserId,
          spotifyUserName: profile.displayName,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
        create: {
          userId: user.id,
          spotifyUserId: profile.providerUserId,
          spotifyUserName: profile.displayName,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
      });
    }

    if (provider === Provider.TIDAL && profile.accessToken) {
      await prisma.tidalConnection.upsert({
        where: { userId: user.id },
        update: {
          tidalUserId: profile.providerUserId,
          tidalUserName: profile.displayName,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
        create: {
          userId: user.id,
          tidalUserId: profile.providerUserId,
          tidalUserName: profile.displayName,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
      });
    }

    if (provider === Provider.DEEZER && profile.accessToken) {
      await prisma.deezerConnection.upsert({
        where: { userId: user.id },
        update: {
          deezerUserId: profile.providerUserId,
          deezerUserName: profile.displayName,
          accessToken: profile.accessToken,
          expiresAt: profile.expiresAt ?? null,
        },
        create: {
          userId: user.id,
          deezerUserId: profile.providerUserId,
          deezerUserName: profile.displayName,
          accessToken: profile.accessToken,
          expiresAt: profile.expiresAt ?? null,
        },
      });
    }

    await createSession(user.id);
    return NextResponse.redirect(new URL(await getPostAuthRedirect(user.id), request.url));
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "";
    console.error(`External auth callback failed for provider ${provider}:`, caughtError);
    const status = message.includes("merge confirmation")
      ? "provider-link-required"
      : "provider-error";

    return redirectWithError(request, status);
  }
}
