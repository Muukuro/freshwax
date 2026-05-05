import { absoluteUrl } from "@/lib/utils";

export function artistPath(artistId: string) {
  return `/artists/${artistId}`;
}

export function releasePath(releaseId: string) {
  return `/releases/${releaseId}`;
}

export function artistUrl(artistId: string) {
  return absoluteUrl(artistPath(artistId));
}

export function releaseUrl(releaseId: string) {
  return absoluteUrl(releasePath(releaseId));
}
