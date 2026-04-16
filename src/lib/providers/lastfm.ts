import { env } from "@/lib/env";

type LastfmTopArtist = {
  name: string;
  playcount?: string;
  mbid?: string;
  url?: string;
};

type LastfmTopArtistsResponse = {
  topartists?: {
    artist?: LastfmTopArtist[];
    "@attr"?: {
      user?: string;
      page?: string;
      perPage?: string;
      totalPages?: string;
      total?: string;
    };
  };
  error?: number;
  message?: string;
};

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";

export function isLastfmConfigured() {
  return Boolean(env.LASTFM_API_KEY);
}

async function lastfmFetch<T>(params: Record<string, string>) {
  if (!env.LASTFM_API_KEY) {
    throw new Error("Last.fm import is not configured");
  }

  const url = new URL(LASTFM_API);

  Object.entries({
    ...params,
    api_key: env.LASTFM_API_KEY,
    format: "json",
  }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Last.fm request failed with ${response.status}`);
  }

  const payload = (await response.json()) as T & {
    error?: number;
    message?: string;
  };

  if (payload.error) {
    throw new Error(payload.message ?? "Last.fm API error");
  }

  return payload as T;
}

export async function fetchUserTopArtists(username: string, minimumPlaycount = 10) {
  const artists: LastfmTopArtist[] = [];
  const perPage = 200;
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const payload = await lastfmFetch<LastfmTopArtistsResponse>({
      method: "user.gettopartists",
      user: username,
      limit: String(perPage),
      page: String(page),
      period: "overall",
    });

    const pageArtists = payload.topartists?.artist ?? [];
    totalPages = Number(payload.topartists?.["@attr"]?.totalPages ?? page);

    if (pageArtists.length === 0) {
      break;
    }

    const matchingArtists = pageArtists.filter((artist) => {
      if (minimumPlaycount <= 0) return true;

      return Number(artist.playcount ?? 0) >= minimumPlaycount;
    });

    artists.push(...matchingArtists);

    const hitThreshold = matchingArtists.length < pageArtists.length;
    if (hitThreshold || page >= totalPages) {
      break;
    }
  }

  return artists.map((artist) => ({
    name: artist.name,
    playcount: artist.playcount ? Number(artist.playcount) : null,
    mbid: artist.mbid ?? null,
    url: artist.url ?? null,
    raw: artist,
  }));
}
