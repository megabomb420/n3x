import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// Load the dependency-free TypeScript helper on the same Node runtime as the app.
const source = await readFile(new URL("../src/lib/club/concurrency.ts", import.meta.url), "utf8");
const { stripTypeScriptTypes } = await import("node:module");
const { mapConcurrent } = await import("data:text/javascript," + encodeURIComponent(stripTypeScriptTypes(source)));

test("starts the next item while a slower sibling is still pending; preserves order", async () => {
  let release;
  const slow = new Promise(resolve => { release = resolve; });
  const started = [];
  let active = 0, peak = 0;
  const result = mapConcurrent([0, 1, 2, 3], 2, async (value) => {
    started.push(value);
    peak = Math.max(peak, ++active);
    if (value === 0) await slow;
    active--;
    return value * 2;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2, 3]);
  assert.equal(peak, 2);
  release();
  assert.deepEqual(await result, [0, 2, 4, 6]);
});
test("empty input and invalid limits", async () => {
  assert.deepEqual(await mapConcurrent([], 6, async x => x), []);
  await assert.rejects(mapConcurrent([1], 0, async x => x), RangeError);
});
test("reports failures", async () => {
  await assert.rejects(mapConcurrent([1], 1, async () => { throw new Error("failed"); }), /failed/);
});
