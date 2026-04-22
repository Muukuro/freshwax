import { Provider, type Prisma } from "@prisma/client";

import { searchArtists as searchDeezerArtists } from "@/lib/providers/deezer";
import { buildArtistPlatformLinks } from "@/lib/platform-links";
import { STREAMING_PROVIDERS, getDefaultProviderPreference } from "@/lib/platforms";
import { normalizeName } from "@/lib/utils";

type MusicBrainzArtist = {
  id?: string;
  name?: string;
  disambiguation?: string;
  score?: number;
};

type MusicBrainzArtistResponse = {
  artists?: MusicBrainzArtist[];
};

export type CatalogArtistSearchResult = {
  catalogArtistId: string;
  musicbrainzArtistId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  popularity: number | null;
  providerMappings: Array<{
    provider: Provider;
    providerArtistId: string;
    url: string | null;
    raw?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }>;
  platformLinks: Array<{
    provider: Provider;
    label: string;
    href: string;
    exact: boolean;
  }>;
};

async function searchMusicBrainzArtists(query: string) {
  if (!query.trim()) {
    return [];
  }

  const url = new URL("https://musicbrainz.org/ws/2/artist");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Freshwax/0.1 (+self-hosted release tracker)",
    },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz artist search failed with ${response.status}`);
  }

  const payload = (await response.json()) as MusicBrainzArtistResponse;

  return (payload.artists ?? [])
    .filter((artist): artist is Required<Pick<MusicBrainzArtist, "name">> & MusicBrainzArtist =>
      Boolean(artist.name),
    )
    .map((artist) => ({
      catalogArtistId: artist.id ?? `name:${normalizeName(artist.name)}`,
      musicbrainzArtistId: artist.id ?? null,
      name: artist.name,
      description: artist.disambiguation ?? null,
      score: typeof artist.score === "number" ? artist.score : null,
    }));
}

export async function searchCatalogArtists(query: string): Promise<CatalogArtistSearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const [musicBrainzResults, deezerResults] = await Promise.all([
    searchMusicBrainzArtists(query).catch(() => []),
    searchDeezerArtists(query).catch(() => []),
  ]);
  const deezerByName = new Map(
    deezerResults.map((result) => [normalizeName(result.name), result]),
  );

  const merged = musicBrainzResults.map((artist) => {
    const deezerMatch = deezerByName.get(normalizeName(artist.name));
    const providerMappings = deezerMatch
      ? [
          {
            provider: Provider.DEEZER,
            providerArtistId: deezerMatch.providerArtistId,
            url: deezerMatch.deezerUrl,
            raw: deezerMatch.raw,
          },
        ]
      : [];

    return {
      catalogArtistId: artist.catalogArtistId,
      musicbrainzArtistId: artist.musicbrainzArtistId,
      name: artist.name,
      description: artist.description,
      imageUrl: deezerMatch?.imageUrl ?? null,
      popularity: deezerMatch?.deezerFans ?? null,
      providerMappings,
      platformLinks: buildArtistPlatformLinks({
        artistName: artist.name,
        mappings: providerMappings,
        preferences: STREAMING_PROVIDERS.map((provider) => ({
          userId: "search",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...getDefaultProviderPreference(provider),
        })),
      }),
    };
  });

  if (merged.length > 0) {
    return merged;
  }

  return deezerResults.slice(0, 10).map((artist) => {
    const providerMappings = [
      {
        provider: Provider.DEEZER,
        providerArtistId: artist.providerArtistId,
        url: artist.deezerUrl,
        raw: artist.raw,
      },
    ];

    return {
      catalogArtistId: `name:${normalizeName(artist.name)}`,
      musicbrainzArtistId: null,
      name: artist.name,
      description: "Resolved from Deezer search",
      imageUrl: artist.imageUrl,
      popularity: artist.deezerFans,
      providerMappings,
      platformLinks: buildArtistPlatformLinks({
        artistName: artist.name,
        mappings: providerMappings,
        preferences: STREAMING_PROVIDERS.map((provider) => ({
          userId: "search",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...getDefaultProviderPreference(provider),
        })),
      }),
    };
  });
}
