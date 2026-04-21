import { ExternalLink, Globe2 } from "lucide-react";
import { Provider } from "@prisma/client";

import {
  AmazonMusicIcon,
  AppleMusicIcon,
  DeezerIcon,
  LastfmIcon,
  SpotifyIcon,
  TidalIcon,
  YouTubeMusicIcon,
} from "@/components/platform-icons";

function getHostname(href: string) {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

type PlatformMatch = {
  iconClass: string;
  icon: React.ReactNode;
};

function matchHostname(hostname: string | null): PlatformMatch | null {
  if (!hostname) return null;

  if (hostname === "open.spotify.com") {
    return { iconClass: "platform-link__icon--spotify", icon: <SpotifyIcon /> };
  }
  if (hostname === "music.apple.com") {
    return { iconClass: "platform-link__icon--applemusic", icon: <AppleMusicIcon /> };
  }
  if (hostname === "music.youtube.com") {
    return { iconClass: "platform-link__icon--youtubemusic", icon: <YouTubeMusicIcon /> };
  }
  if (hostname === "music.amazon.com") {
    return { iconClass: "platform-link__icon--amazonmusic", icon: <AmazonMusicIcon /> };
  }
  if (hostname === "listen.tidal.com" || hostname === "tidal.com" || hostname === "www.tidal.com") {
    return { iconClass: "platform-link__icon--tidal", icon: <TidalIcon /> };
  }
  if (hostname === "deezer.com" || hostname === "www.deezer.com") {
    return { iconClass: "platform-link__icon--deezer", icon: <DeezerIcon /> };
  }
  if (hostname === "www.last.fm" || hostname === "last.fm") {
    return { iconClass: "platform-link__icon--lastfm", icon: <LastfmIcon /> };
  }

  return null;
}

function providerIconClass(provider: Provider): string {
  switch (provider) {
    case Provider.SPOTIFY: return "platform-link__icon--spotify";
    case Provider.APPLE_MUSIC: return "platform-link__icon--applemusic";
    case Provider.YOUTUBE_MUSIC: return "platform-link__icon--youtubemusic";
    case Provider.AMAZON_MUSIC: return "platform-link__icon--amazonmusic";
    case Provider.TIDAL: return "platform-link__icon--tidal";
    case Provider.DEEZER: return "platform-link__icon--deezer";
    default: return "";
  }
}

function providerIcon(provider: Provider) {
  switch (provider) {
    case Provider.SPOTIFY: return <SpotifyIcon />;
    case Provider.APPLE_MUSIC: return <AppleMusicIcon />;
    case Provider.YOUTUBE_MUSIC: return <YouTubeMusicIcon />;
    case Provider.AMAZON_MUSIC: return <AmazonMusicIcon />;
    case Provider.TIDAL: return <TidalIcon />;
    case Provider.DEEZER: return <DeezerIcon />;
    default: return <Globe2 className="h-3 w-3 text-white/60" />;
  }
}

export function PlatformIcon({ provider, size = "md" }: { provider: Provider; size?: "sm" | "md" }) {
  const iconClass = providerIconClass(provider);
  const icon = providerIcon(provider);
  const sizeClass = size === "sm" ? "w-[1.1rem] h-[1.1rem]" : "w-[1.35rem] h-[1.35rem]";

  return (
    <span
      aria-hidden="true"
      className={["platform-link__icon inline-flex shrink-0", sizeClass, iconClass].filter(Boolean).join(" ")}
    >
      {icon}
    </span>
  );
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
  const match = matchHostname(hostname);

  return (
    <a
      className={[compact ? "platform-link platform-link--compact" : "platform-link", className]
        .filter(Boolean)
        .join(" ")}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span
        aria-hidden="true"
        className={["platform-link__icon", match?.iconClass ?? ""].filter(Boolean).join(" ")}
      >
        {match?.icon ?? <Globe2 className="h-3.5 w-3.5" />}
      </span>
      <span>{label}</span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
