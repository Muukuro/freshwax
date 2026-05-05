import { cookies } from "next/headers";
import { Provider } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  completeExternalAuth,
  getProviderSlug,
  getPkceCookieName,
  getReturnOriginCookieName,
  providerFromSlug,
} from "@/lib/external-auth";
import {
  createExternalIdentityUser,
  createSession,
  ensureUserScaffold,
  getCurrentUser,
  getPostAuthRedirect,
} from "@/lib/auth";
import { createAccountMergeIntent, setAccountMergeCookie } from "@/lib/account-merge";
import { prisma } from "@/lib/db";
import { getRequestOrigin } from "@/lib/utils";

function buildRedirectUrl(request: Request, path: string, returnOrigin?: string | null) {
  if (returnOrigin) {
    try {
      return new URL(path, returnOrigin);
    } catch {
      // Fall back to the external request origin if the stored origin is malformed.
    }
  }

  return new URL(path, getRequestOrigin(request));
}

function redirectWithError(request: Request, status: string, returnOrigin?: string | null) {
  return NextResponse.redirect(buildRedirectUrl(request, `/login?error=${status}`, returnOrigin));
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
  const returnOrigin = cookieStore.get(getReturnOriginCookieName(provider))?.value;
  cookieStore.delete(`freshwax_${getProviderSlug(provider)}_oauth_state`);
  cookieStore.delete(getPkceCookieName(provider));
  cookieStore.delete(getReturnOriginCookieName(provider));

  if (error) {
    return redirectWithError(request, "provider-denied", returnOrigin);
  }

  if (!code) {
    return redirectWithError(request, "provider-missing-code", returnOrigin);
  }

  if (!stateCookie || !returnedState || stateCookie !== returnedState) {
    return redirectWithError(request, "provider-state", returnOrigin);
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
        const token = await createAccountMergeIntent({
          targetUserId: currentUser.id,
          sourceUserId: existingIdentity.userId,
          provider,
          providerUserId: profile.providerUserId,
        });

        await setAccountMergeCookie(token);
        return NextResponse.redirect(buildRedirectUrl(request, "/settings?accountMerge=pending", returnOrigin));
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

      return NextResponse.redirect(buildRedirectUrl(request, "/settings", returnOrigin));
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
    return NextResponse.redirect(
      buildRedirectUrl(request, await getPostAuthRedirect(user.id), returnOrigin),
    );
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "";
    console.error(`External auth callback failed for provider ${provider}:`, caughtError);
    const status = message.includes("merge confirmation")
      ? "provider-link-required"
      : "provider-error";

    return redirectWithError(request, status, returnOrigin);
  }
}
