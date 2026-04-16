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
  supportsFollowImport: boolean;
  supportsArtistLinks: boolean;
  supportsReleaseLinks: boolean;
  supportsCatalogSearch: boolean;
  supportsReleaseSync: boolean;
  supportsExactArtistLinks: boolean;
  supportsExactReleaseLinks: boolean;
};

const providerCapabilities: Record<StreamingProvider, ProviderCapability> = {
  [Provider.SPOTIFY]: {
    label: "Spotify",
    description: "OAuth login, account linking, followed-artist import, and catalog enrichment.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsFollowImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: true,
    supportsReleaseSync: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.APPLE_MUSIC]: {
    label: "Apple Music",
    description: "Sign in with Apple plus optional MusicKit account linking and outbound links.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsFollowImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: false,
    supportsReleaseSync: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.YOUTUBE_MUSIC]: {
    label: "YouTube Music",
    description: "Google-based sign-in and outbound links. Import is links-only in this pass.",
    supportsLogin: true,
    supportsAccountLink: false,
    supportsFollowImport: false,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: false,
    supportsReleaseSync: false,
    supportsExactArtistLinks: false,
    supportsExactReleaseLinks: false,
  },
  [Provider.AMAZON_MUSIC]: {
    label: "Amazon Music",
    description: "Login with Amazon and outbound links while import/catalog access remains gated.",
    supportsLogin: true,
    supportsAccountLink: false,
    supportsFollowImport: false,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: false,
    supportsReleaseSync: false,
    supportsExactArtistLinks: false,
    supportsExactReleaseLinks: false,
  },
  [Provider.TIDAL]: {
    label: "TIDAL",
    description: "OAuth login, account linking, followed-artist import, and catalog enrichment.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsFollowImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: true,
    supportsReleaseSync: true,
    supportsExactArtistLinks: true,
    supportsExactReleaseLinks: true,
  },
  [Provider.DEEZER]: {
    label: "Deezer",
    description: "OAuth login, account linking, import, and catalog enrichment when an existing app is available.",
    supportsLogin: true,
    supportsAccountLink: true,
    supportsFollowImport: true,
    supportsArtistLinks: true,
    supportsReleaseLinks: true,
    supportsCatalogSearch: true,
    supportsReleaseSync: true,
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
    allowImport: capability.supportsFollowImport,
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

  if (!isProviderConfigured(provider)) {
    return "Not configured by operator";
  }

  if (!capability.supportsFollowImport && !capability.supportsCatalogSearch) {
    return "Supported for links only";
  }

  return "Available on this instance";
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
