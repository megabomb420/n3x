/**
 * The two decisions a stuck app makes: is this a stale build, and what would a
 * reload be answered from. A wrong answer here is a user staring at a dead end.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { documentCacheKeys, isStaleChunkError } from "./recovery.ts";

test("a chunk the host no longer serves is recognised in every browser's wording", () => {
  assert.equal(isStaleChunkError("Importing a module script failed."), true, "Safari");
  assert.equal(
    isStaleChunkError(
      new Error("Failed to fetch dynamically imported module: https://host/assets/m._tag-X.js"),
    ),
    true,
    "Chromium",
  );
  assert.equal(
    isStaleChunkError('Failed to load module script: MIME type of "text/html"'),
    true,
    "a host serving a document for a chunk",
  );
  assert.equal(
    isStaleChunkError(new Error("NetworkError when attempting to fetch resource.")),
    false,
  );
  assert.equal(isStaleChunkError(null), false);
  assert.equal(isStaleChunkError(""), false);
});

test("only the document caches are dropped, never the CDN one", () => {
  assert.deepEqual(
    documentCacheKeys(["hotlane-cdn-v1", "n3x-shell-v3", "n3x-shell-v4", "something-else"]),
    ["n3x-shell-v3", "n3x-shell-v4"],
  );
  assert.deepEqual(documentCacheKeys([]), []);
});
