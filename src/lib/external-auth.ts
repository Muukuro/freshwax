import { createHash, randomBytes } from "node:crypto";

import { Provider } from "@prisma/client";

import {
  exchangeDeezerCodeForToken,
  fetchCurrentDeezerUser,
  getDeezerAuthorizeUrl,
  generateDeezerOAuthState,
} from "@/lib/providers/deezer";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/utils";

export function providerFromSlug(slug: string) {
  switch (slug) {
    case "spotify":
      return Provider.SPOTIFY;
    case "apple_music":
      return Provider.APPLE_MUSIC;
    case "youtube_music":
      return Provider.YOUTUBE_MUSIC;
    case "amazon_music":
      return Provider.AMAZON_MUSIC;
    case "tidal":
      return Provider.TIDAL;
    case "deezer":
      return Provider.DEEZER;
    default:
      return null;
  }
}

export function getProviderSlug(provider: Provider) {
  return provider.toLowerCase();
}

export function getExternalAuthCallbackUrl(provider: Provider) {
  return absoluteUrl(`/api/auth/${getProviderSlug(provider)}/callback`);
}

function stateCookieName(provider: Provider) {
  return `freshwax_${getProviderSlug(provider)}_oauth_state`;
}

export function createExternalAuthState(provider: Provider) {
  return {
    cookieName: stateCookieName(provider),
    state: provider === Provider.DEEZER ? generateDeezerOAuthState() : randomBytes(24).toString("hex"),
  };
}

function pkceCookieName(provider: Provider) {
  return `freshwax_${getProviderSlug(provider)}_oauth_pkce_verifier`;
}

function returnOriginCookieName(provider: Provider) {
  return `freshwax_${getProviderSlug(provider)}_oauth_return_origin`;
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

export function createPkceVerifier() {
  return toBase64Url(randomBytes(32));
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getPkceCookieName(provider: Provider) {
  return pkceCookieName(provider);
}

export function getReturnOriginCookieName(provider: Provider) {
  return returnOriginCookieName(provider);
}

type ExternalProfile = {
  providerUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  raw?: unknown;
};

const TIDAL_REQUIRED_SCOPES = ["user.read", "collection.read", "collection.write"] as const;

export function isExternalAuthImplemented(provider: Provider) {
  const implementedProviders: Provider[] = [
    Provider.SPOTIFY,
    Provider.TIDAL,
    Provider.YOUTUBE_MUSIC,
    Provider.AMAZON_MUSIC,
    Provider.DEEZER,
  ];

  return implementedProviders.includes(provider);
}

export function isExternalAuthConfigured(provider: Provider) {
  switch (provider) {
    case Provider.SPOTIFY:
      return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
    case Provider.YOUTUBE_MUSIC:
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    case Provider.AMAZON_MUSIC:
      return Boolean(env.AMAZON_CLIENT_ID && env.AMAZON_CLIENT_SECRET);
    case Provider.TIDAL:
      return Boolean(env.TIDAL_CLIENT_ID);
    case Provider.DEEZER:
      return Boolean(env.DEEZER_APP_ID && env.DEEZER_APP_SECRET);
    default:
      return false;
  }
}

export function getExternalAuthAvailabilityNote(provider: Provider) {
  if (!isExternalAuthConfigured(provider)) {
    return "Not configured by operator";
  }

  if (!isExternalAuthImplemented(provider)) {
    return "Login not implemented yet";
  }

  return "Available on this instance";
}

export function getExternalAuthAuthorizeUrl(
  provider: Provider,
  state: string,
  options?: { codeChallenge?: string },
) {
  switch (provider) {
    case Provider.SPOTIFY: {
      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("client_id", env.SPOTIFY_CLIENT_ID ?? "");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", getExternalAuthCallbackUrl(provider));
      url.searchParams.set("scope", "user-read-email user-read-private user-follow-read");
      url.searchParams.set("state", state);
      return url.toString();
    }
    case Provider.YOUTUBE_MUSIC: {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", getExternalAuthCallbackUrl(provider));
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      return url.toString();
    }
    case Provider.AMAZON_MUSIC: {
      const url = new URL("https://www.amazon.com/ap/oa");
      url.searchParams.set("client_id", env.AMAZON_CLIENT_ID ?? "");
      url.searchParams.set("scope", "profile");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", getExternalAuthCallbackUrl(provider));
      url.searchParams.set("state", state);
      return url.toString();
    }
    case Provider.TIDAL: {
      const url = new URL("https://login.tidal.com/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", env.TIDAL_CLIENT_ID ?? "");
      url.searchParams.set("redirect_uri", getExternalAuthCallbackUrl(provider));
      url.searchParams.set("scope", TIDAL_REQUIRED_SCOPES.join(" "));
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("code_challenge", options?.codeChallenge ?? "");
      url.searchParams.set("state", state);
      return url.toString();
    }
    case Provider.DEEZER:
      return getDeezerAuthorizeUrl(state);
    default:
      throw new Error("External auth is not implemented for this provider");
  }
}

async function exchangeSpotifyCode(code: string): Promise<ExternalProfile> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      redirect_uri: getExternalAuthCallbackUrl(Provider.SPOTIFY),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed with ${response.status}`);
  }

  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const profileResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    throw new Error(`Spotify profile fetch failed with ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
    id: string;
    email?: string;
    display_name?: string;
    images?: { url?: string }[];
  };

  return {
    providerUserId: profile.id,
    email: profile.email ?? `${profile.id}@spotify.local`,
    displayName: profile.display_name ?? null,
    avatarUrl: profile.images?.[0]?.url ?? null,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    raw: profile,
  };
}

async function exchangeGoogleCode(code: string): Promise<ExternalProfile> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getExternalAuthCallbackUrl(Provider.YOUTUBE_MUSIC),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with ${response.status}`);
  }

  const token = (await response.json()) as {
    access_token: string;
  };
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    throw new Error(`Google profile fetch failed with ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  return {
    providerUserId: profile.sub,
    email: profile.email ?? `${profile.sub}@google.local`,
    displayName: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
    accessToken: token.access_token,
    raw: profile,
  };
}

async function exchangeAmazonCode(code: string): Promise<ExternalProfile> {
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.AMAZON_CLIENT_ID ?? "",
      client_secret: env.AMAZON_CLIENT_SECRET ?? "",
      redirect_uri: getExternalAuthCallbackUrl(Provider.AMAZON_MUSIC),
    }),
  });

  if (!response.ok) {
    throw new Error(`Amazon token exchange failed with ${response.status}`);
  }

  const token = (await response.json()) as { access_token: string };
  const profileResponse = await fetch("https://api.amazon.com/user/profile", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    throw new Error(`Amazon profile fetch failed with ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
    user_id: string;
    email?: string;
    name?: string;
  };

  return {
    providerUserId: profile.user_id,
    email: profile.email ?? `${profile.user_id}@amazon.local`,
    displayName: profile.name ?? null,
    avatarUrl: null,
    accessToken: token.access_token,
    raw: profile,
  };
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    return payload;
  } catch {
    return null;
  }
}

async function fetchTidalProfile(accessToken: string) {
  const candidateUrls = [
    "https://openapi.tidal.com/v2/users/me",
    "https://openapi.tidal.com/v2/me",
  ];
  const failedAttempts: string[] = [];

  for (const url of candidateUrls) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      failedAttempts.push(`${url} -> ${response.status}`);
      continue;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const data =
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : payload;
    const attributes =
      data.attributes && typeof data.attributes === "object" && !Array.isArray(data.attributes)
        ? (data.attributes as Record<string, unknown>)
        : data;
    const providerUserId = typeof data.id === "string" ? data.id : null;

    if (!providerUserId) {
      continue;
    }

    return {
      providerUserId,
      email:
        typeof attributes.email === "string" && attributes.email
          ? attributes.email
          : `${providerUserId}@tidal.local`,
      displayName:
        (typeof attributes.name === "string" && attributes.name) ||
        (typeof attributes.firstName === "string" && attributes.firstName.trim()) ||
        (typeof attributes.username === "string" && attributes.username) ||
        null,
      avatarUrl: null,
      raw: payload,
    };
  }

  if (failedAttempts.length > 0) {
    console.warn("TIDAL profile lookup did not resolve a user profile:", failedAttempts.join(", "));
  }

  return null;
}

async function exchangeTidalCode(code: string, codeVerifier?: string): Promise<ExternalProfile> {
  if (!env.TIDAL_CLIENT_ID) {
    throw new Error("TIDAL OAuth is not configured");
  }

  if (!codeVerifier) {
    throw new Error("TIDAL PKCE verifier is missing");
  }

  const response = await fetch("https://auth.tidal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.TIDAL_CLIENT_ID,
      code,
      redirect_uri: getExternalAuthCallbackUrl(Provider.TIDAL),
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TIDAL token exchange failed with ${response.status}: ${body}`);
  }

  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };

  if (!token.access_token) {
    throw new Error("TIDAL token exchange did not return an access token");
  }

  const idTokenPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;
  const accessTokenPayload = decodeJwtPayload(token.access_token);
  const profile = await fetchTidalProfile(token.access_token).catch(() => null);
  const uidFromPayload =
    typeof idTokenPayload?.uid === "number"
      ? String(idTokenPayload.uid)
      : typeof idTokenPayload?.uid === "string"
        ? idTokenPayload.uid
        : typeof accessTokenPayload?.uid === "number"
          ? String(accessTokenPayload.uid)
          : typeof accessTokenPayload?.uid === "string"
            ? accessTokenPayload.uid
            : null;
  const subject =
    profile?.providerUserId ??
    (typeof idTokenPayload?.sub === "string" ? idTokenPayload.sub : null) ??
    (typeof accessTokenPayload?.sub === "string" ? accessTokenPayload.sub : null) ??
    uidFromPayload;

  if (!subject) {
    throw new Error(
      `TIDAL did not expose a stable user identifier. id_token_sub=${String(idTokenPayload?.sub ?? "")} access_token_sub=${String(accessTokenPayload?.sub ?? "")} uid=${String(uidFromPayload ?? "")}`,
    );
  }

  const email =
    profile?.email ??
    (typeof idTokenPayload?.email === "string" ? idTokenPayload.email : null) ??
    `${subject}@tidal.local`;
  const displayName =
    profile?.displayName ??
    (typeof idTokenPayload?.name === "string" ? idTokenPayload.name : null) ??
    (typeof accessTokenPayload?.preferred_username === "string"
      ? accessTokenPayload.preferred_username
      : null);

  return {
    providerUserId: subject,
    email,
    displayName,
    avatarUrl: null,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    raw: {
      token,
      profile: profile?.raw ?? null,
    },
  };
}

async function exchangeDeezer(code: string): Promise<ExternalProfile> {
  const token = await exchangeDeezerCodeForToken(code);
  const profile = await fetchCurrentDeezerUser(token.accessToken);

  return {
    providerUserId: profile.deezerUserId,
    email: `${profile.deezerUserId}@deezer.local`,
    displayName: profile.deezerUserName ?? null,
    avatarUrl: null,
    accessToken: token.accessToken,
    expiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null,
    raw: profile.raw,
  };
}

export async function completeExternalAuth(
  provider: Provider,
  code: string,
  options?: { codeVerifier?: string },
) {
  switch (provider) {
    case Provider.SPOTIFY:
      return exchangeSpotifyCode(code);
    case Provider.TIDAL:
      return exchangeTidalCode(code, options?.codeVerifier);
    case Provider.YOUTUBE_MUSIC:
      return exchangeGoogleCode(code);
    case Provider.AMAZON_MUSIC:
      return exchangeAmazonCode(code);
    case Provider.DEEZER:
      return exchangeDeezer(code);
    default:
      throw new Error("External auth callback is not implemented for this provider");
  }
}
