import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createPkceChallenge,
  createPkceVerifier,
  createExternalAuthState,
  getExternalAuthAuthorizeUrl,
  getPkceCookieName,
  getReturnOriginCookieName,
  isExternalAuthConfigured,
  isExternalAuthImplemented,
  providerFromSlug,
} from "@/lib/external-auth";
import { Provider } from "@prisma/client";
import { getRequestOrigin } from "@/lib/utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerSlug } = await context.params;
  const provider = providerFromSlug(providerSlug);

  if (!provider) {
    return NextResponse.redirect(new URL("/login?error=provider", request.url));
  }

  if (!isExternalAuthImplemented(provider)) {
    return NextResponse.redirect(new URL("/login?error=provider-unavailable", request.url));
  }

  if (!isExternalAuthConfigured(provider)) {
    return NextResponse.redirect(new URL("/login?error=provider-not-configured", request.url));
  }

  const { cookieName, state } = createExternalAuthState(provider);
  const cookieStore = await cookies();
  cookieStore.set(cookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const pkceVerifier = provider === Provider.TIDAL ? createPkceVerifier() : null;
  if (pkceVerifier) {
    cookieStore.set(getPkceCookieName(provider), pkceVerifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  cookieStore.set(getReturnOriginCookieName(provider), getRequestOrigin(request), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(
    getExternalAuthAuthorizeUrl(provider, state, {
      codeChallenge: pkceVerifier ? createPkceChallenge(pkceVerifier) : undefined,
    }),
  );
}
