export function buildFollowedMusicBrainzArtistIdSet(
  followedArtists: Iterable<{ musicbrainzArtistId: string | null }>,
) {
  return new Set(
    [...followedArtists]
      .map((artist) => artist.musicbrainzArtistId)
      .filter((musicbrainzArtistId): musicbrainzArtistId is string =>
        Boolean(musicbrainzArtistId),
      ),
  );
}

export function isMusicBrainzArtistFollowed(
  followedMusicBrainzArtistIds: ReadonlySet<string>,
  musicbrainzArtistId: string | null | undefined,
) {
  return Boolean(musicbrainzArtistId && followedMusicBrainzArtistIds.has(musicbrainzArtistId));
}
