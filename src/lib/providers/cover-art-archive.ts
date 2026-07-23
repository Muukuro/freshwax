const COVER_ART_ARCHIVE_API = "https://coverartarchive.org";

type CoverArtArchiveImage = {
  approved?: unknown;
  front?: unknown;
  id?: unknown;
};

type CoverArtArchivePayload = {
  images?: unknown;
  release?: unknown;
};

export type CoverArtArchiveResult = {
  coverUrl: string;
  source: {
    imageId: string;
    releaseGroupId: string;
    releaseId: string;
  };
};

function parseReleaseId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] === "release" && segments[1] ? segments[1] : null;
  } catch {
    return null;
  }
}

export function parseCoverArtArchiveReleaseGroup(
  releaseGroupId: string,
  payload: unknown,
): CoverArtArchiveResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as CoverArtArchivePayload;
  if (!Array.isArray(data.images)) {
    return null;
  }

  const front = (data.images as CoverArtArchiveImage[]).find(
    (image) => image?.approved === true && image.front === true && typeof image.id === "string",
  );
  const releaseId = parseReleaseId(data.release);

  if (!front || typeof front.id !== "string" || !releaseId) {
    return null;
  }

  return {
    coverUrl: `${COVER_ART_ARCHIVE_API}/release/${encodeURIComponent(releaseId)}/${encodeURIComponent(front.id)}-500.jpg`,
    source: {
      imageId: front.id,
      releaseGroupId,
      releaseId,
    },
  };
}

export async function fetchReleaseGroupCoverArt(
  releaseGroupId: string,
): Promise<CoverArtArchiveResult | null> {
  try {
    const response = await fetch(
      `${COVER_ART_ARCHIVE_API}/release-group/${encodeURIComponent(releaseGroupId)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    return parseCoverArtArchiveReleaseGroup(releaseGroupId, await response.json());
  } catch {
    return null;
  }
}
