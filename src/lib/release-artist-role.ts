export const RELEASE_ARTIST_ROLE = {
  PRIMARY: "primary",
  COMPOSER_APPEARANCE: "composer_appearance",
} as const;

export type ReleaseArtistRole = (typeof RELEASE_ARTIST_ROLE)[keyof typeof RELEASE_ARTIST_ROLE];
