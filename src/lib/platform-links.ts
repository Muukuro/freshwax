import { Provider, type UserPlatformPreference } from "@prisma/client";

import {
  STREAMING_PROVIDERS,
  buildArtistSearchUrl,
  buildReleaseSearchUrl,
  getProviderCapability,
  getProviderLabel,
} from "@/lib/platforms";

type MappingLike = {
  provider: Provider;
  url: string | null;
};

export type PlatformLinkEntry = {
  provider: Provider;
  label: string;
  href: string;
  exact: boolean;
};

function sortProviders(preferences: UserPlatformPreference[]) {
  const rankByProvider = new Map(
    preferences.map((preference) => [
      preference.provider,
      preference.favoriteRank ?? Number.MAX_SAFE_INTEGER,
    ]),
  );

  return [...STREAMING_PROVIDERS].sort((left, right) => {
    const rankDelta = (rankByProvider.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (rankByProvider.get(right) ?? Number.MAX_SAFE_INTEGER);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    return getProviderLabel(left).localeCompare(getProviderLabel(right));
  });
}

export function buildArtistPlatformLinks(input: {
  artistName: string;
  mappings: MappingLike[];
  preferences: UserPlatformPreference[];
}) {
  const mappingByProvider = new Map<Provider, string>();
  for (const mapping of input.mappings) {
    if (mapping.url) {
      mappingByProvider.set(mapping.provider, mapping.url);
    }
  }
  const enabled = new Set(
    input.preferences.filter((preference) => preference.showArtistLinks).map((entry) => entry.provider),
  );

  return sortProviders(input.preferences).flatMap((provider) => {
    if (!enabled.has(provider) || !getProviderCapability(provider).supportsArtistLinks) {
      return [];
    }

    const href =
      mappingByProvider.get(provider) ??
      buildArtistSearchUrl(provider, input.artistName);

    return href
      ? [{ provider, label: getProviderLabel(provider), href, exact: mappingByProvider.has(provider) }]
      : [];
  });
}

export function buildReleasePlatformLinks(input: {
  artistName: string;
  releaseTitle: string;
  mappings: MappingLike[];
  preferences: UserPlatformPreference[];
}) {
  const mappingByProvider = new Map<Provider, string>();
  for (const mapping of input.mappings) {
    if (mapping.url) {
      mappingByProvider.set(mapping.provider, mapping.url);
    }
  }
  const enabled = new Set(
    input.preferences.filter((preference) => preference.showReleaseLinks).map((entry) => entry.provider),
  );

  return sortProviders(input.preferences).flatMap((provider) => {
    if (!enabled.has(provider) || !getProviderCapability(provider).supportsReleaseLinks) {
      return [];
    }

    const href =
      mappingByProvider.get(provider) ??
      buildReleaseSearchUrl(provider, input.artistName, input.releaseTitle);

    return href
      ? [{ provider, label: getProviderLabel(provider), href, exact: mappingByProvider.has(provider) }]
      : [];
  });
}
