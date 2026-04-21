import { Provider } from "@prisma/client";

import { env } from "@/lib/env";

export const STREAMING_PROVIDERS = [
  Provider.SPOTIFY,
  Provider.APPLE_MUSIC,
  Provider.YOUTUBE_MUSIC,
  Provider.AMAZON_MUSIC,
  Provider.TIDAL,
  Provider.DEEZER,
] as const;

export type StreamingProvider = (typeof STREAMING_PROVIDERS)[number];

export type ProviderCapability = {
  label: string;
  description: string;
  supportsLogin: boolean;
  supportsAccountLink: boolean;
  supportsOptionalImport: boolean;
  supportsArtistLinks: boolean;
  supportsReleaseLinks: boolean;
  supportsCoreSearch: boolean;
  supportsCoreReleaseDiscovery: boolean;
  supportsOptionalEnrichment: boolean;
  requiresOperatorConfiguration: boolean;
  supportsExactArtistLinks: boolean;
  supportsExactReleaseLinks: boolean;
};

const providerCapabilities: Record<StreamingProvider, ProviderCapability> = {
  [Provider.SPOTIFY]: {
    label: "Spotify",
    description: "Optional account linking, import, and exact links when operator credentials are configured.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsOptionalImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.APPLE_MUSIC]: {
    label: "Apple Music",
    description: "Optional account linking and exact links when operator credentials are configured.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsOptionalImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.YOUTUBE_MUSIC]: {
    label: "YouTube Music",
    description: "Optional login-branded links with search fallbacks; not required for core tracking.",
    supportsLogin: true,
    supportsAccountLink: false,
    supportsOptionalImport: false,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: true,
    supportsExactArtistLinks: false,
    supportsExactReleaseLinks: false,
  },
  [Provider.AMAZON_MUSIC]: {
    label: "Amazon Music",
    description: "Optional login-branded links with search fallbacks; not required for core tracking.",
    supportsLogin: true,
    supportsAccountLink: false,
    supportsOptionalImport: false,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: true,
    supportsExactArtistLinks: false,
    supportsExactReleaseLinks: false,
  },
  [Provider.TIDAL]: {
    label: "TIDAL",
    description: "Optional account linking, import, and exact links when operator credentials are configured.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsOptionalImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.DEEZER]: {
    label: "Deezer",
    description: "Public catalog enrichment plus optional account linking and import when an existing app is configured.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsOptionalImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCoreSearch: false,
    supportsCoreReleaseDiscovery: false,
    supportsOptionalEnrichment: true,
    requiresOperatorConfiguration: false,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
};

export function getProviderCapability(provider: StreamingProvider) {
  return providerCapabilities[provider];
}

export function getProviderLabel(provider: Provider) {
  return providerCapabilities[provider as StreamingProvider]?.label ?? provider.replaceAll("_", " ");
}

export function getDefaultProviderPreference(provider: StreamingProvider) {
  const capability = getProviderCapability(provider);

  return {
    provider,
    allowImport: capability.supportsOptionalImport,
    showArtistLinks: capability.supportsArtistLinks,
    showReleaseLinks: capability.supportsReleaseLinks,
    isFavorite: provider === Provider.SPOTIFY || provider === Provider.APPLE_MUSIC,
    favoriteRank:
      provider === Provider.SPOTIFY ? 1 : provider === Provider.APPLE_MUSIC ? 2 : null,
  };
}

export function isProviderConfigured(provider: StreamingProvider) {
  switch (provider) {
    case Provider.SPOTIFY:
      return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
    case Provider.APPLE_MUSIC:
      return Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID);
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

export function getProviderAvailabilityNote(provider: StreamingProvider) {
  const capability = getProviderCapability(provider);

  if (!capability.requiresOperatorConfiguration) {
    return "Optional enrichment only";
  }

  if (!isProviderConfigured(provider)) {
    return "Optional integration not configured";
  }

  if (!capability.supportsOptionalImport && !capability.supportsOptionalEnrichment) {
    return "Links only";
  }

  return "Optional integration available";
}

export function buildArtistDeepLink(provider: Provider, providerArtistId: string): string | null {
  switch (provider) {
    case Provider.SPOTIFY:
      return `https://open.spotify.com/artist/${providerArtistId}`;
    case Provider.DEEZER:
      return `https://www.deezer.com/artist/${providerArtistId}`;
    case Provider.TIDAL:
      return `https://listen.tidal.com/artist/${providerArtistId}`;
    case Provider.YOUTUBE_MUSIC:
      return `https://music.youtube.com/channel/${providerArtistId}`;
    default:
      return null;
  }
}

export function buildReleaseDeepLink(provider: Provider, providerReleaseId: string): string | null {
  switch (provider) {
    case Provider.SPOTIFY:
      return `https://open.spotify.com/album/${providerReleaseId}`;
    case Provider.DEEZER:
      return `https://www.deezer.com/album/${providerReleaseId}`;
    case Provider.TIDAL:
      return `https://listen.tidal.com/album/${providerReleaseId}`;
    default:
      return null;
  }
}

export function buildArtistSearchUrl(provider: Provider, artistName: string) {
  const query = encodeURIComponent(artistName);

  switch (provider) {
    case Provider.SPOTIFY:
      return `https://open.spotify.com/search/${query}/artists`;
    case Provider.APPLE_MUSIC:
      return `https://music.apple.com/us/search?term=${query}`;
    case Provider.YOUTUBE_MUSIC:
      return `https://music.youtube.com/search?q=${query}`;
    case Provider.AMAZON_MUSIC:
      return `https://music.amazon.com/search/${query}`;
    case Provider.TIDAL:
      return `https://listen.tidal.com/search?q=${query}`;
    case Provider.DEEZER:
      return `https://www.deezer.com/search/${query}`;
    default:
      return null;
  }
}

export function buildReleaseSearchUrl(provider: Provider, artistName: string, releaseTitle: string) {
  const query = encodeURIComponent(`${artistName} ${releaseTitle}`);

  switch (provider) {
    case Provider.SPOTIFY:
      return `https://open.spotify.com/search/${query}`;
    case Provider.APPLE_MUSIC:
      return `https://music.apple.com/us/search?term=${query}`;
    case Provider.YOUTUBE_MUSIC:
      return `https://music.youtube.com/search?q=${query}`;
    case Provider.AMAZON_MUSIC:
      return `https://music.amazon.com/search/${query}`;
    case Provider.TIDAL:
      return `https://listen.tidal.com/search?q=${query}`;
    case Provider.DEEZER:
      return `https://www.deezer.com/search/${query}`;
    default:
      return null;
  }
}
