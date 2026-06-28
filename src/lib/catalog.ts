import { Provider, type Prisma } from "@prisma/client";

import { searchArtists as searchDeezerArtists } from "@/lib/providers/deezer";
import {
  searchArtistMbid,
  searchArtists as searchMusicBrainzProviderArtists,
} from "@/lib/providers/musicbrainz";
import { buildArtistPlatformLinks } from "@/lib/platform-links";
import { STREAMING_PROVIDERS, getDefaultProviderPreference } from "@/lib/platforms";
import { normalizeName } from "@/lib/utils";

export type CatalogArtistSearchResult = {
  catalogArtistId: string;
  musicbrainzArtistId: string;
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

function getAmbiguousNormalizedNames(
  artists: Array<{ name: string }>,
) {
  const counts = new Map<string, number>();

  for (const artist of artists) {
    const normalizedName = normalizeName(artist.name);
    if (!normalizedName) continue;

    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([normalizedName]) => normalizedName),
  );
}

async function searchMusicBrainzArtists(query: string) {
  const artists = await searchMusicBrainzProviderArtists(query, 10);

  return artists.map((artist) => ({
    catalogArtistId: artist.id,
    musicbrainzArtistId: artist.id,
    name: artist.name,
    description: artist.disambiguation,
    score: artist.score,
  }));
}

async function resolveDeezerArtistMusicbrainzId(name: string) {
  try {
    return await searchArtistMbid(name);
  } catch {
    return null;
  }
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
  const ambiguousMusicBrainzNames = getAmbiguousNormalizedNames(musicBrainzResults);

  const merged = musicBrainzResults.map((artist) => {
    const normalizedName = normalizeName(artist.name);
    const deezerMatch = ambiguousMusicBrainzNames.has(normalizedName)
      ? undefined
      : deezerByName.get(normalizedName);
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

  const deezerFallbackResults = [];
  for (const artist of deezerResults.slice(0, 10)) {
    deezerFallbackResults.push({
      artist,
      musicbrainzArtistId: await resolveDeezerArtistMusicbrainzId(artist.name),
    });
  }

  return deezerFallbackResults.flatMap(({ artist, musicbrainzArtistId }) => {
    if (!musicbrainzArtistId) {
      return [];
    }

    const providerMappings = [
      {
        provider: Provider.DEEZER,
        providerArtistId: artist.providerArtistId,
        url: artist.deezerUrl,
        raw: artist.raw,
      },
    ];

    return {
      catalogArtistId: musicbrainzArtistId,
      musicbrainzArtistId,
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
