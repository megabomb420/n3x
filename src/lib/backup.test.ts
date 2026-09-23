import assert from "node:assert/strict";
import test from "node:test";
import {
  applyImport,
  buildExport,
  clearOwned,
  collectOwned,
  ImportError,
  parseExport,
  serializeExport,
  storageSummary,
  type StorageLike,
} from "./backup.ts";

/** A `Storage` stand-in with one foreign key, to prove nothing else is touched. */
function memory(seed: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const SEED = {
  "n3x.lang": "pl",
  "n3x.ladder.country": "pl",
  "hotlane:v2:club-home": '{"savedAt":1,"value":{"club":{"members":[]}}}',
  "other-app.token": "keep me",
};

test("an export carries our keys and leaves another app's alone", () => {
  const storage = memory(SEED);
  const entries = collectOwned(storage);
  assert.deepEqual(Object.keys(entries).sort(), ["hotlane:v2:club-home", "n3x.ladder.country", "n3x.lang"]);
  assert.equal(entries["other-app.token"], undefined);
});

test("export, import and reset round-trip without touching a foreign key", () => {
  const storage = memory(SEED);
  const file = buildExport(storage, new Date("2026-09-23T10:15:00.000Z"));
  assert.equal(file.exportedAt, "2026-09-23T10:15:00.000Z");

  const restored = parseExport(serializeExport(file));
  assert.equal(restored.entries["n3x.lang"], "pl");

  const target = memory({ "other-app.token": "keep me", "n3x.lang": "en" });
  assert.equal(applyImport(target, restored), 3);
  assert.equal(target.dump()["n3x.lang"], "pl");
  assert.equal(target.dump()["other-app.token"], "keep me");

  assert.equal(clearOwned(target), 3);
  assert.deepEqual(target.dump(), { "other-app.token": "keep me" });
});

test("a file that is not ours is refused with a reason", () => {
  assert.throws(() => parseExport("<html>"), ImportError);
  assert.throws(() => parseExport('{"hello":true}'), /format marker/);
  assert.throws(() => parseExport('{"format":"n3x-export","formatVersion":9}'), /format 9/);
  assert.throws(
    () => parseExport('{"format":"n3x-export","formatVersion":1,"entries":{"n3x.lang":7}}'),
    /not a string/,
  );
});

test("an import ignores keys we do not own instead of writing them", () => {
  const file = parseExport(
    '{"format":"n3x-export","formatVersion":1,"entries":{"other-app.token":"evil","n3x.lang":"pl"}}',
  );
  assert.deepEqual(Object.keys(file.entries), ["n3x.lang"]);
});

test("the summary counts only our keys", () => {
  const summary = storageSummary(memory(SEED));
  assert.equal(summary.count, 3);
  assert.match(summary.label, /B$|kB$/);
});
