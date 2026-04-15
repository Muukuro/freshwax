import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  generateDeezerOAuthState,
  getDeezerAuthorizeUrl,
  isDeezerOAuthConfigured,
} from "@/lib/providers/deezer";
import { isProduction } from "@/lib/env";

const DEEZER_STATE_COOKIE = "nrt_deezer_oauth_state";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isDeezerOAuthConfigured()) {
    return NextResponse.redirect(new URL("/settings?deezer=not-configured", request.url));
  }

  const state = generateDeezerOAuthState();
  const cookieStore = await cookies();
  cookieStore.set(DEEZER_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(getDeezerAuthorizeUrl(state));
}
