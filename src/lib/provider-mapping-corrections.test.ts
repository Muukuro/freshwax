import test from "node:test";
import assert from "node:assert/strict";
import { Provider } from "@prisma/client";

import { parseManualProviderMappingInput } from "@/lib/provider-mapping-corrections";

test("parses localized Deezer artist URLs into canonical artist mappings", () => {
  assert.deepEqual(
    parseManualProviderMappingInput({
      provider: Provider.DEEZER,
      target: "artist",
      value: "https://www.deezer.com/en/artist/7699874",
    }),
    {
      provider: Provider.DEEZER,
      providerId: "7699874",
      url: "https://www.deezer.com/artist/7699874",
    },
  );
});

test("parses raw Deezer album IDs into canonical release mappings", () => {
  assert.deepEqual(
    parseManualProviderMappingInput({
      provider: Provider.DEEZER,
      target: "release",
      value: "123456",
    }),
    {
      provider: Provider.DEEZER,
      providerId: "123456",
      url: "https://www.deezer.com/album/123456",
    },
  );
});

test("rejects provider URLs for the wrong target type", () => {
  assert.throws(
    () =>
      parseManualProviderMappingInput({
        provider: Provider.DEEZER,
        target: "release",
        value: "https://www.deezer.com/en/artist/7699874",
      }),
    /valid release URL/,
  );
});

test("parses Apple Music artist URLs by their numeric provider ID", () => {
  assert.deepEqual(
    parseManualProviderMappingInput({
      provider: Provider.APPLE_MUSIC,
      target: "artist",
      value: "https://music.apple.com/us/artist/aurora/947171503",
    }),
    {
      provider: Provider.APPLE_MUSIC,
      providerId: "947171503",
      url: "https://music.apple.com/us/artist/aurora/947171503",
    },
  );
});

test("parses YouTube Music playlist release URLs", () => {
  assert.deepEqual(
    parseManualProviderMappingInput({
      provider: Provider.YOUTUBE_MUSIC,
      target: "release",
      value: "https://music.youtube.com/playlist?list=OLAK5uy_example",
    }),
    {
      provider: Provider.YOUTUBE_MUSIC,
      providerId: "OLAK5uy_example",
      url: "https://music.youtube.com/playlist?list=OLAK5uy_example",
    },
  );
});
