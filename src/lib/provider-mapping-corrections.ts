import {
  Prisma,
  Provider,
  ProviderMappingSource,
  type ArtistProviderMapping,
  type ReleaseProviderMapping,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildArtistDeepLink, buildReleaseDeepLink } from "@/lib/platforms";
import { fetchAlbumById, fetchArtistById } from "@/lib/providers/deezer";

export type MappingTarget = "artist" | "release";

type ParsedProviderMapping = {
  provider: Provider;
  providerId: string;
  url: string | null;
};

function hasValue(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function providerFromValue(value: string): Provider | null {
  return Provider[value as keyof typeof Provider] ?? null;
}

function segmentsWithoutLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])) {
    return segments.slice(1);
  }
  return segments;
}

function lastNumericSegment(segments: string[]) {
  const candidate = segments.at(-1);
  return candidate && /^\d+$/.test(candidate) ? candidate : null;
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function parseProviderUrl(provider: Provider, target: MappingTarget, value: string): ParsedProviderMapping | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  const segments = segmentsWithoutLocale(parsed.pathname);
  const [first, second] = segments;

  switch (provider) {
    case Provider.SPOTIFY:
      if (hostname !== "open.spotify.com") return null;
      if (target === "artist" && first === "artist" && second) {
        return { provider, providerId: second, url: `https://open.spotify.com/artist/${second}` };
      }
      if (target === "release" && first === "album" && second) {
        return { provider, providerId: second, url: `https://open.spotify.com/album/${second}` };
      }
      return null;

    case Provider.DEEZER:
      if (hostname !== "deezer.com") return null;
      if (target === "artist" && first === "artist" && second && /^\d+$/.test(second)) {
        return { provider, providerId: second, url: buildArtistDeepLink(provider, second) };
      }
      if (target === "release" && first === "album" && second && /^\d+$/.test(second)) {
        return { provider, providerId: second, url: buildReleaseDeepLink(provider, second) };
      }
      return null;

    case Provider.TIDAL:
      if (hostname !== "tidal.com" && hostname !== "listen.tidal.com") return null;
      if (target === "artist" && first === "artist" && second) {
        return { provider, providerId: second, url: buildArtistDeepLink(provider, second) };
      }
      if (target === "release" && first === "album" && second) {
        return { provider, providerId: second, url: buildReleaseDeepLink(provider, second) };
      }
      return null;

    case Provider.APPLE_MUSIC: {
      if (hostname !== "music.apple.com") return null;
      const id = lastNumericSegment(segments);
      if (!id) return null;
      if (target === "artist" && segments.includes("artist")) {
        return { provider, providerId: id, url: parsed.toString() };
      }
      if (target === "release" && segments.includes("album")) {
        return { provider, providerId: id, url: parsed.toString() };
      }
      return null;
    }

    case Provider.YOUTUBE_MUSIC:
      if (hostname !== "music.youtube.com") return null;
      if (target === "artist" && first === "channel" && second) {
        return { provider, providerId: second, url: buildArtistDeepLink(provider, second) };
      }
      if (target === "release" && first === "browse" && second) {
        return { provider, providerId: second, url: buildReleaseDeepLink(provider, second) };
      }
      if (target === "release" && parsed.searchParams.get("list")) {
        const id = parsed.searchParams.get("list")!;
        return { provider, providerId: id, url: `https://music.youtube.com/playlist?list=${id}` };
      }
      return null;

    case Provider.AMAZON_MUSIC:
      if (hostname !== "music.amazon.com") return null;
      if (target === "artist" && first === "artists" && second) {
        return { provider, providerId: second, url: buildArtistDeepLink(provider, second) };
      }
      if (target === "release" && first === "albums" && second) {
        return { provider, providerId: second, url: buildReleaseDeepLink(provider, second) };
      }
      return null;

    default:
      return null;
  }
}

export function parseManualProviderMappingInput(input: {
  provider: Provider | string;
  target: MappingTarget;
  value: string;
}): ParsedProviderMapping {
  const provider = typeof input.provider === "string" ? providerFromValue(input.provider) : input.provider;
  if (!provider) {
    throw new Error("Choose a supported provider");
  }

  const value = input.value.trim();
  if (!value) {
    throw new Error("Enter a provider URL or ID");
  }

  const parsedUrl = parseProviderUrl(provider, input.target, value);
  if (parsedUrl) return parsedUrl;

  if (/^https?:\/\//i.test(value)) {
    throw new Error(`Enter a valid ${input.target} URL for this provider`);
  }

  if (/\s|\//.test(value)) {
    throw new Error("Enter a provider URL or a raw provider ID");
  }

  return {
    provider,
    providerId: value,
    url:
      input.target === "artist"
        ? buildArtistDeepLink(provider, value)
        : buildReleaseDeepLink(provider, value),
  };
}

function inputJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null
    ? undefined
    : (value as Prisma.InputJsonValue);
}

export function isManualMapping(
  mapping: Pick<ArtistProviderMapping | ReleaseProviderMapping, "source" | "manuallyCorrectedAt">,
) {
  return mapping.source === ProviderMappingSource.MANUAL || mapping.manuallyCorrectedAt !== null;
}

export async function setManualArtistProviderMapping(input: {
  artistId: string;
  provider: Provider | string;
  value: string;
}) {
  const parsed = parseManualProviderMappingInput({
    provider: input.provider,
    target: "artist",
    value: input.value,
  });
  const verified =
    parsed.provider === Provider.DEEZER
      ? await fetchArtistById(parsed.providerId)
      : null;
  const url = verified?.deezerUrl ?? parsed.url;
  const correctedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.artistProviderMapping.deleteMany({
      where: {
        artistId: input.artistId,
        provider: parsed.provider,
        providerArtistId: { not: parsed.providerId },
      },
    });

    await tx.artistProviderMapping.upsert({
      where: {
        provider_providerArtistId: {
          provider: parsed.provider,
          providerArtistId: parsed.providerId,
        },
      },
      update: {
        artistId: input.artistId,
        url,
        rawJson: inputJson(verified?.raw),
        source: ProviderMappingSource.MANUAL,
        manuallyCorrectedAt: correctedAt,
      },
      create: {
        artistId: input.artistId,
        provider: parsed.provider,
        providerArtistId: parsed.providerId,
        url,
        rawJson: inputJson(verified?.raw),
        source: ProviderMappingSource.MANUAL,
        manuallyCorrectedAt: correctedAt,
      },
    });

    if (verified) {
      await tx.artist.update({
        where: { id: input.artistId },
        data: {
          imageUrl: verified.imageUrl ?? undefined,
          deezerFans: verified.deezerFans ?? undefined,
        },
      });
    }
  });
}

export async function removeManualArtistProviderMapping(input: {
  artistId: string;
  provider: Provider | string;
}) {
  const provider = providerFromValue(String(input.provider));
  if (!provider) throw new Error("Choose a supported provider");

  await prisma.artistProviderMapping.deleteMany({
    where: {
      artistId: input.artistId,
      provider,
    },
  });
}

export async function setManualReleaseProviderMapping(input: {
  releaseId: string;
  provider: Provider | string;
  value: string;
}) {
  const parsed = parseManualProviderMappingInput({
    provider: input.provider,
    target: "release",
    value: input.value,
  });
  const verified =
    parsed.provider === Provider.DEEZER
      ? await fetchAlbumById(parsed.providerId)
      : null;
  const url = verified?.deezerUrl ?? parsed.url;
  const correctedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.releaseProviderMapping.deleteMany({
      where: {
        releaseId: input.releaseId,
        provider: parsed.provider,
        providerReleaseId: { not: parsed.providerId },
      },
    });

    await tx.releaseProviderMapping.upsert({
      where: {
        provider_providerReleaseId: {
          provider: parsed.provider,
          providerReleaseId: parsed.providerId,
        },
      },
      update: {
        releaseId: input.releaseId,
        url,
        rawJson: inputJson(verified?.raw),
        source: ProviderMappingSource.MANUAL,
        manuallyCorrectedAt: correctedAt,
      },
      create: {
        releaseId: input.releaseId,
        provider: parsed.provider,
        providerReleaseId: parsed.providerId,
        url,
        rawJson: inputJson(verified?.raw),
        source: ProviderMappingSource.MANUAL,
        manuallyCorrectedAt: correctedAt,
      },
    });

    if (verified) {
      await tx.release.update({
        where: { id: input.releaseId },
        data: {
          coverUrl: verified.coverUrl ?? undefined,
          deezerUrl: verified.deezerUrl,
          rawSource: {
            source: "manual-provider-mapping",
            deezer: verified.raw,
          } satisfies Prisma.InputJsonValue,
        },
      });
    }
  });
}

export async function removeManualReleaseProviderMapping(input: {
  releaseId: string;
  provider: Provider | string;
}) {
  const provider = providerFromValue(String(input.provider));
  if (!provider) throw new Error("Choose a supported provider");

  await prisma.releaseProviderMapping.deleteMany({
    where: {
      releaseId: input.releaseId,
      provider,
    },
  });
}

export function currentMappingValue(
  mapping:
    | Pick<ArtistProviderMapping, "providerArtistId" | "url">
    | Pick<ReleaseProviderMapping, "providerReleaseId" | "url">
    | null
    | undefined,
) {
  if (!mapping) return "";
  if (hasValue(mapping.url)) return mapping.url;
  return "providerArtistId" in mapping ? mapping.providerArtistId : mapping.providerReleaseId;
}
