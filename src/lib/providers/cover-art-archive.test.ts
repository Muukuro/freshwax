import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchReleaseGroupCoverArt,
  parseCoverArtArchiveReleaseGroup,
} from "@/lib/providers/cover-art-archive";

const RELEASE_GROUP_ID = "c31a5e2b-0bf8-32e0-8aeb-ef4ba9973932";
const RELEASE_ID = "f268b8bc-2768-426b-901b-c7966e76de29";

test("selects an approved front image and builds a stable 500px URL", () => {
  assert.deepEqual(
    parseCoverArtArchiveReleaseGroup(RELEASE_GROUP_ID, {
      release: `https://musicbrainz.org/release/${RELEASE_ID}`,
      images: [
        { id: "back", approved: true, front: false },
        { id: "pending", approved: false, front: true },
        { id: "12750224075", approved: true, front: true },
      ],
    }),
    {
      coverUrl:
        `https://coverartarchive.org/release/${RELEASE_ID}/12750224075-500.jpg`,
      source: {
        imageId: "12750224075",
        releaseGroupId: RELEASE_GROUP_ID,
        releaseId: RELEASE_ID,
      },
    },
  );
});

test("returns null without an approved front image or for malformed metadata", () => {
  assert.equal(
    parseCoverArtArchiveReleaseGroup(RELEASE_GROUP_ID, {
      release: `https://musicbrainz.org/release/${RELEASE_ID}`,
      images: [{ id: "back", approved: true, front: false }],
    }),
    null,
  );
  assert.equal(parseCoverArtArchiveReleaseGroup(RELEASE_GROUP_ID, { images: "invalid" }), null);
});

test("treats missing responses and provider failures as no artwork", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => new Response(null, { status: 404 });
    assert.equal(await fetchReleaseGroupCoverArt(RELEASE_GROUP_ID), null);

    global.fetch = async () => {
      throw new Error("provider unavailable");
    };
    assert.equal(await fetchReleaseGroupCoverArt(RELEASE_GROUP_ID), null);
  } finally {
    global.fetch = originalFetch;
  }
});
