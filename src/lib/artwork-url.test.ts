import test from "node:test";
import assert from "node:assert/strict";

import {
  safeImageSrc,
  selectPreferredArtworkUrl,
} from "@/lib/artwork-url";

const DEEZER_URL = "https://cdn-images.dzcdn.net/images/cover/example/500x500.jpg";
const CAA_URL =
  "https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd/829521842-500.jpg";

test("allows supported HTTPS artwork sources and local images", () => {
  assert.equal(safeImageSrc(DEEZER_URL), DEEZER_URL);
  assert.equal(safeImageSrc(CAA_URL), CAA_URL);
  assert.equal(safeImageSrc("/icons/fallback.png"), "/icons/fallback.png");
});

test("rejects unsafe or unsupported artwork URLs", () => {
  assert.equal(safeImageSrc("http://coverartarchive.org/release/example"), null);
  assert.equal(safeImageSrc("https://example.com/cover.jpg"), null);
  assert.equal(safeImageSrc("not a url"), null);
});

test("prefers incoming Deezer artwork over Cover Art Archive artwork", () => {
  assert.equal(selectPreferredArtworkUrl(CAA_URL, DEEZER_URL), DEEZER_URL);
});

test("preserves stored Deezer artwork over Cover Art Archive artwork", () => {
  assert.equal(selectPreferredArtworkUrl(DEEZER_URL, CAA_URL), DEEZER_URL);
});

test("fills missing artwork and preserves stored artwork after a failed lookup", () => {
  assert.equal(selectPreferredArtworkUrl(null, CAA_URL), CAA_URL);
  assert.equal(selectPreferredArtworkUrl(CAA_URL, null), CAA_URL);
});
