import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/utils";

type DeezerArtist = {
  id: number;
  name: string;
  link: string;
  picture_medium?: string;
  nb_fan?: number;
};

type DeezerAlbum = {
  id: number;
  title: string;
  link: string;
  cover_medium?: string;
  cover_xl?: string;
  release_date: string;
  record_type?: string;
};

type DeezerUser = {
  id: number;
  name?: string;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  next?: string;
};

const DEEZER_API = "https://api.deezer.com";
const DEEZER_CONNECT = "https://connect.deezer.com";
const DEEZER_PERMISSIONS = ["basic_access", "manage_library", "offline_access"];

async function deezerFetch<T>(
  url: string,
  options?: {
    accessToken?: string;
    cache?: RequestCache;
    nextRevalidate?: number;
  },
) {
  const requestUrl = new URL(url);

  if (options?.accessToken) {
    requestUrl.searchParams.set("access_token", options.accessToken);
  }

  const response = await fetch(requestUrl, {
    cache: options?.cache,
    next: options?.nextRevalidate ? { revalidate: options.nextRevalidate } : undefined,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Deezer request failed with ${response.status}`);
  }

  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new Error(payload.error.message ?? "Deezer API error");
  }

  return payload as T;
}

function mapArtist(artist: DeezerArtist) {
  return {
    providerArtistId: String(artist.id),
    name: artist.name,
    deezerUrl: artist.link,
    imageUrl: artist.picture_medium ?? null,
    deezerFans: artist.nb_fan ?? null,
    raw: artist,
  };
}

export function getDeezerOAuthCallbackUrl() {
  return absoluteUrl("/api/deezer/callback");
}

export function generateDeezerOAuthState() {
  return randomBytes(24).toString("hex");
}

export function isDeezerOAuthConfigured() {
  return Boolean(env.DEEZER_APP_ID && env.DEEZER_APP_SECRET);
}

export function getDeezerAuthorizeUrl(state: string) {
  if (!env.DEEZER_APP_ID) {
    throw new Error("Deezer OAuth is not configured");
  }

  const url = new URL("/oauth/auth.php", DEEZER_CONNECT);
  url.searchParams.set("app_id", env.DEEZER_APP_ID);
  url.searchParams.set("redirect_uri", getDeezerOAuthCallbackUrl());
  url.searchParams.set("perms", DEEZER_PERMISSIONS.join(","));
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeDeezerCodeForToken(code: string) {
  if (!env.DEEZER_APP_ID || !env.DEEZER_APP_SECRET) {
    throw new Error("Deezer OAuth is not configured");
  }

  const url = new URL("/oauth/access_token.php", DEEZER_CONNECT);
  url.searchParams.set("app_id", env.DEEZER_APP_ID);
  url.searchParams.set("secret", env.DEEZER_APP_SECRET);
  url.searchParams.set("code", code);
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Deezer token exchange failed with ${response.status}`);
  }

  const body = await response.text();

  try {
    const payload = JSON.parse(body) as {
      access_token?: string;
      expires?: number;
      error_reason?: string;
      error?: { message?: string };
    };

    if (payload.error_reason || payload.error) {
      throw new Error(payload.error?.message ?? payload.error_reason ?? "Deezer token exchange failed");
    }

    if (!payload.access_token) {
      throw new Error("Deezer token exchange did not return an access token");
    }

    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires ?? null,
    };
  } catch {
    const params = new URLSearchParams(body);
    const accessToken = params.get("access_token");
    const expiresRaw = params.get("expires");
    const errorReason = params.get("error_reason");

    if (errorReason) {
      throw new Error(errorReason);
    }

    if (!accessToken) {
      throw new Error("Deezer token exchange did not return an access token");
    }

    return {
      accessToken,
      expiresIn: expiresRaw ? Number(expiresRaw) : null,
    };
  }
}

export async function fetchCurrentDeezerUser(accessToken: string) {
  const payload = await deezerFetch<DeezerUser>(`${DEEZER_API}/user/me`, {
    accessToken,
    cache: "no-store",
  });

  return {
    deezerUserId: String(payload.id),
    deezerUserName: payload.name ?? null,
    raw: payload,
  };
}

export async function searchArtists(query: string) {
  if (!query.trim()) return [];

  const url = `${DEEZER_API}/search/artist?q=${encodeURIComponent(query.trim())}`;
  const payload = await deezerFetch<PaginatedResponse<DeezerArtist>>(url, {
    nextRevalidate: 60 * 30,
  });

  return payload.data.slice(0, 15).map(mapArtist);
}

export async function fetchCurrentUserFollowedArtists(accessToken: string) {
  const artists: DeezerArtist[] = [];
  let nextUrl = `${DEEZER_API}/user/me/artists?limit=100`;
  let pages = 0;

  while (nextUrl && pages < 10) {
    const payload = await deezerFetch<PaginatedResponse<DeezerArtist>>(nextUrl, {
      accessToken,
      cache: "no-store",
    });
    artists.push(...payload.data);
    nextUrl = payload.next ?? "";
    pages += 1;
  }

  return artists.map(mapArtist);
}

export async function fetchArtistReleases(providerArtistId: string) {
  const releases: DeezerAlbum[] = [];
  let nextUrl = `${DEEZER_API}/artist/${providerArtistId}/albums?limit=100`;
  let pages = 0;

  while (nextUrl && pages < 3) {
    const payload = await deezerFetch<PaginatedResponse<DeezerAlbum>>(nextUrl, {
      nextRevalidate: 60 * 30,
    });
    releases.push(...payload.data);
    nextUrl = payload.next ?? "";
    pages += 1;
  }

  return releases.map((release) => ({
    providerReleaseId: String(release.id),
    title: release.title,
    deezerUrl: release.link,
    coverUrl: release.cover_xl ?? release.cover_medium ?? null,
    releaseDate: release.release_date,
    recordType: release.record_type ?? null,
    raw: release,
  }));
}
