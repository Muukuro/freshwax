import test from "node:test";
import assert from "node:assert/strict";
import { NotificationDeliveryStatus } from "@prisma/client";

import {
  chooseDeliveryStatus,
  chooseReleaseArtistRole,
  getLegacyReleaseGroupMbid,
  selectReleaseIdentityMatch,
} from "@/lib/release-duplicates";
import { RELEASE_ARTIST_ROLE } from "@/lib/release-artist-role";

const release = (id: string, releaseGroupMbid: string | null) => ({
  id,
  releaseGroupMbid,
});

test("release matching prefers MusicBrainz identity over provider and shape", () => {
  assert.equal(
    selectReleaseIdentityMatch({
      incomingReleaseGroupMbid: "mbid-1",
      byMusicBrainz: release("musicbrainz", "mbid-1"),
      byProvider: release("provider", null),
      byShape: release("shape", null),
    })?.id,
    "musicbrainz",
  );
});

test("release matching prefers an exact provider mapping over shape", () => {
  assert.equal(
    selectReleaseIdentityMatch({
      incomingReleaseGroupMbid: null,
      byMusicBrainz: null,
      byProvider: release("provider", null),
      byShape: release("shape", null),
    })?.id,
    "provider",
  );
});

test("same title and date do not merge different MusicBrainz release groups", () => {
  assert.equal(
    selectReleaseIdentityMatch({
      incomingReleaseGroupMbid: "mbid-new",
      byMusicBrainz: null,
      byProvider: null,
      byShape: release("shape", "mbid-existing"),
    }),
    null,
  );
});

test("legacy MusicBrainz release-group identity is recovered from raw source", () => {
  assert.equal(
    getLegacyReleaseGroupMbid({
      source: "musicbrainz",
      releaseGroupId: "legacy-mbid",
    }),
    "legacy-mbid",
  );
  assert.equal(getLegacyReleaseGroupMbid({ source: "deezer" }), null);
  assert.equal(getLegacyReleaseGroupMbid(null), null);
});

test("artist role merging preserves a primary association", () => {
  assert.equal(
    chooseReleaseArtistRole(
      RELEASE_ARTIST_ROLE.COMPOSER_APPEARANCE,
      RELEASE_ARTIST_ROLE.PRIMARY,
    ),
    RELEASE_ARTIST_ROLE.PRIMARY,
  );
});

test("delivery merging never loses delivered state", () => {
  assert.equal(
    chooseDeliveryStatus(
      NotificationDeliveryStatus.FAILED,
      NotificationDeliveryStatus.DELIVERED,
    ),
    NotificationDeliveryStatus.DELIVERED,
  );
  assert.equal(
    chooseDeliveryStatus(
      NotificationDeliveryStatus.DELIVERED,
      NotificationDeliveryStatus.PENDING,
    ),
    NotificationDeliveryStatus.DELIVERED,
  );
});
