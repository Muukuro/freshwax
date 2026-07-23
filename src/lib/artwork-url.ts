const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
  "api.deezer.com",
  "cdn-images.dzcdn.net",
  "coverartarchive.org",
]);

const DEEZER_IMAGE_HOSTS = new Set(["api.deezer.com", "cdn-images.dzcdn.net"]);

function getHttpsHostname(src: string | null | undefined) {
  if (!src) {
    return null;
  }

  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
}

export function safeImageSrc(src: string | null | undefined) {
  if (!src) {
    return null;
  }

  if (src.startsWith("/")) {
    return src;
  }

  const hostname = getHttpsHostname(src);
  if (!hostname || !ALLOWED_REMOTE_IMAGE_HOSTS.has(hostname)) {
    return null;
  }

  return new URL(src).toString();
}

export function isDeezerArtworkUrl(src: string | null | undefined) {
  const hostname = getHttpsHostname(src);
  return hostname !== null && DEEZER_IMAGE_HOSTS.has(hostname);
}

/**
 * Deezer artwork is the preferred enrichment. Other acceptable artwork can
 * fill an empty value, while a failed lookup must never erase stored artwork.
 */
export function selectPreferredArtworkUrl(
  storedUrl: string | null | undefined,
  incomingUrl: string | null | undefined,
) {
  if (!incomingUrl) {
    return storedUrl ?? null;
  }

  if (!storedUrl || isDeezerArtworkUrl(incomingUrl)) {
    return incomingUrl;
  }

  if (isDeezerArtworkUrl(storedUrl)) {
    return storedUrl;
  }

  return incomingUrl;
}
