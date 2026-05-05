"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";

const ALLOWED_REMOTE_IMAGE_HOSTS = new Set(["api.deezer.com", "cdn-images.dzcdn.net"]);

function safeImageSrc(src: string | null | undefined) {
  if (!src) {
    return null;
  }

  if (src.startsWith("/")) {
    return src;
  }

  try {
    const url = new URL(src);
    if (url.protocol !== "https:") {
      return null;
    }

    return ALLOWED_REMOTE_IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Artwork({
  alt,
  className,
  fallback,
  sizes,
  src,
}: {
  alt: string;
  className?: string;
  fallback?: ReactNode;
  sizes: string;
  src: string | null | undefined;
}) {
  const imageSrc = useMemo(() => safeImageSrc(src), [src]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = imageSrc !== null && imageSrc !== failedSrc;

  return (
    <div className={clsx("release-art release-art--fallback artwork", className)}>
      {showImage ? (
        <Image
          alt={alt}
          className="artwork__image"
          fill
          onError={() => setFailedSrc(imageSrc)}
          sizes={sizes}
          src={imageSrc}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
