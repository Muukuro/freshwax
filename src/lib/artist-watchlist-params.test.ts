import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArtistsHref,
  getPaginationItems,
  parseArtistsSearchParams,
} from "./artist-watchlist-params";

test("artists search params default empty and invalid values to the first page", () => {
  assert.deepEqual(parseArtistsSearchParams({ watchlistPage: "not-a-page" }), {
    catalogQuery: "",
    watchlistQuery: "",
    watchlistPage: 1,
  });
  assert.equal(parseArtistsSearchParams({ watchlistPage: "0" }).watchlistPage, 1);
  assert.equal(parseArtistsSearchParams({ watchlistPage: "-2" }).watchlistPage, 1);
});

test("artists search params trim values and use the first repeated value", () => {
  assert.deepEqual(
    parseArtistsSearchParams({
      q: ["  bjork ", "ignored"],
      watchlist: ["  radiohead  ", "ignored"],
      watchlistPage: ["3", "7"],
    }),
    {
      catalogQuery: "bjork",
      watchlistQuery: "radiohead",
      watchlistPage: 3,
    },
  );
});

test("artists href preserves catalog search and omits the default watchlist page", () => {
  assert.equal(
    buildArtistsHref({
      catalogQuery: "Björk",
      watchlistQuery: "radio",
    }),
    "/artists?q=Bj%C3%B6rk&watchlist=radio",
  );
});

test("artists href includes a non-default watchlist page", () => {
  assert.equal(
    buildArtistsHref({
      catalogQuery: "Björk",
      watchlistQuery: "radio",
      watchlistPage: 4,
    }),
    "/artists?q=Bj%C3%B6rk&watchlist=radio&watchlistPage=4",
  );
});

test("changing a watchlist filter resets pagination when page is omitted", () => {
  assert.equal(
    buildArtistsHref({
      catalogQuery: "catalog query",
      watchlistQuery: "new filter",
    }),
    "/artists?q=catalog+query&watchlist=new+filter",
  );
});

test("pagination items keep large page ranges compact", () => {
  assert.deepEqual(getPaginationItems(10, 20), [1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]);
  assert.deepEqual(getPaginationItems(1, 3), [1, 2, 3]);
});
