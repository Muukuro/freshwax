"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";

import { safeImageSrc } from "@/lib/artwork-url";

export function Artwork({
  alt,
  className,
  fallback,
  height,
  isAboveFold = false,
  sizes,
  src,
  width,
}: {
  alt: string;
  className?: string;
  fallback?: ReactNode;
  height?: number;
  isAboveFold?: boolean;
  sizes: string;
  src: string | null | undefined;
  width?: number;
}) {
  const imageSrc = useMemo(() => safeImageSrc(src), [src]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = imageSrc !== null && imageSrc !== failedSrc;
  const hasIntrinsicSize = width !== undefined && height !== undefined;

  return (
    <div className={clsx("release-art release-art--fallback artwork", className)}>
      {showImage && hasIntrinsicSize ? (
        <Image
          alt={alt}
          className="artwork__image"
          height={height}
          loading={isAboveFold ? "eager" : "lazy"}
          onError={() => setFailedSrc(imageSrc)}
          sizes={sizes}
          src={imageSrc}
          width={width}
        />
      ) : showImage ? (
        <Image
          alt={alt}
          className="artwork__image"
          fill
          loading={isAboveFold ? "eager" : "lazy"}
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
