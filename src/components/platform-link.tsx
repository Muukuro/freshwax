import { ExternalLink, Globe2 } from "lucide-react";

function getHostname(href: string) {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

function getFaviconUrl(hostname: string | null) {
  if (!hostname) {
    return null;
  }

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function isDeezerHostname(hostname: string | null) {
  return hostname === "deezer.com" || hostname === "www.deezer.com";
}

function isTidalHostname(hostname: string | null) {
  return hostname === "listen.tidal.com" || hostname === "tidal.com" || hostname === "www.tidal.com";
}

function isLastfmHostname(hostname: string | null) {
  return hostname === "www.last.fm" || hostname === "last.fm";
}

function faviconOverride(hostname: string | null) {
  if (isDeezerHostname(hostname)) {
    return "https://www.deezer.com/favicon.ico";
  }

  if (isTidalHostname(hostname)) {
    return "https://listen.tidal.com/favicon.ico";
  }

  if (isLastfmHostname(hostname)) {
    return "https://www.last.fm/favicon.ico";
  }

  if (hostname === "open.spotify.com") {
    return "https://open.spotify.com/favicon.ico";
  }

  if (hostname === "music.apple.com") {
    return "https://music.apple.com/favicon.ico";
  }

  if (hostname === "music.youtube.com") {
    return "https://music.youtube.com/favicon.ico";
  }

  if (hostname === "music.amazon.com") {
    return "https://music.amazon.com/favicon.ico";
  }

  return getFaviconUrl(hostname);
}

export function PlatformLink({
  href,
  label,
  className = "",
  compact = false,
}: {
  href: string;
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const hostname = getHostname(href);
  const isDeezer = isDeezerHostname(hostname);
  const isTidal = isTidalHostname(hostname);
  const isLastfm = isLastfmHostname(hostname);
  const faviconUrl = faviconOverride(hostname);

  return (
    <a
      className={[
        compact ? "platform-link platform-link--compact" : "platform-link",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span
        aria-hidden="true"
        className={[
          "platform-link__icon",
          isDeezer ? "platform-link__icon--deezer" : "",
          isTidal ? "platform-link__icon--tidal" : "",
          isLastfm ? "platform-link__icon--lastfm" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {faviconUrl ? (
          <span
            className="platform-link__favicon"
            style={{ backgroundImage: `url(${faviconUrl})` }}
          />
        ) : (
          <Globe2 className="h-3.5 w-3.5" />
        )}
      </span>
      <span>{label}</span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
