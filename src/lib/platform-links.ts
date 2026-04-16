import { Provider, type UserPlatformPreference } from "@prisma/client";

import {
  STREAMING_PROVIDERS,
  buildArtistDeepLink,
  buildArtistSearchUrl,
  buildReleaseDeepLink,
  buildReleaseSearchUrl,
  getProviderCapability,
  getProviderLabel,
} from "@/lib/platforms";

type ArtistMappingLike = {
  provider: Provider;
  url: string | null;
  providerArtistId?: string | null;
};

type ReleaseMappingLike = {
  provider: Provider;
  url: string | null;
  providerReleaseId?: string | null;
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
  mappings: ArtistMappingLike[];
  preferences: UserPlatformPreference[];
}) {
  const urlByProvider = new Map<Provider, string>();
  const idByProvider = new Map<Provider, string>();
  for (const mapping of input.mappings) {
    if (mapping.url) urlByProvider.set(mapping.provider, mapping.url);
    if (mapping.providerArtistId) idByProvider.set(mapping.provider, mapping.providerArtistId);
  }
  const enabled = new Set(
    input.preferences.filter((preference) => preference.showArtistLinks).map((entry) => entry.provider),
  );

  return sortProviders(input.preferences).flatMap((provider) => {
    if (!enabled.has(provider) || !getProviderCapability(provider).supportsArtistLinks) {
      return [];
    }

    const storedUrl = urlByProvider.get(provider);
    const deepLink = idByProvider.has(provider)
      ? buildArtistDeepLink(provider, idByProvider.get(provider)!)
      : null;
    const href = storedUrl ?? deepLink ?? buildArtistSearchUrl(provider, input.artistName);
    const exact = Boolean(storedUrl ?? deepLink);

    return href ? [{ provider, label: getProviderLabel(provider), href, exact }] : [];
  });
}

export function buildReleasePlatformLinks(input: {
  artistName: string;
  releaseTitle: string;
  mappings: ReleaseMappingLike[];
  preferences: UserPlatformPreference[];
}) {
  const urlByProvider = new Map<Provider, string>();
  const idByProvider = new Map<Provider, string>();
  for (const mapping of input.mappings) {
    if (mapping.url) urlByProvider.set(mapping.provider, mapping.url);
    if (mapping.providerReleaseId) idByProvider.set(mapping.provider, mapping.providerReleaseId);
  }
  const enabled = new Set(
    input.preferences.filter((preference) => preference.showReleaseLinks).map((entry) => entry.provider),
  );

  return sortProviders(input.preferences).flatMap((provider) => {
    if (!enabled.has(provider) || !getProviderCapability(provider).supportsReleaseLinks) {
      return [];
    }

    const storedUrl = urlByProvider.get(provider);
    const deepLink = idByProvider.has(provider)
      ? buildReleaseDeepLink(provider, idByProvider.get(provider)!)
      : null;
    const href = storedUrl ?? deepLink ?? buildReleaseSearchUrl(provider, input.artistName, input.releaseTitle);
    const exact = Boolean(storedUrl ?? deepLink);

    return href ? [{ provider, label: getProviderLabel(provider), href, exact }] : [];
  });
}
