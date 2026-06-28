import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFollowedMusicBrainzArtistIdSet,
  isMusicBrainzArtistFollowed,
} from "@/lib/artist-follow-status";

test("followed state is keyed by MusicBrainz artist ID, not artist name", () => {
  const followed = buildFollowedMusicBrainzArtistIdSet([
    {
      musicbrainzArtistId: "f9dfece0-a7c4-4d89-b037-015c8f005cdb",
    },
  ]);

  assert.equal(
    isMusicBrainzArtistFollowed(
      followed,
      "f9dfece0-a7c4-4d89-b037-015c8f005cdb",
    ),
    true,
  );
  assert.equal(
    isMusicBrainzArtistFollowed(
      followed,
      "a0c83cf0-7571-4538-a430-fb04c408d4d2",
    ),
    false,
  );
});
