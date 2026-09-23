/**
 * The rotation's own reading: which event a map is on is not something the
 * payload answers on its own, because `active` and `upcoming` carry the same
 * shape. A wrong answer here is the "Live now" badge on a map that is only next.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { findMapEvent, formatWindow, type RotationPayload } from "./rotation.ts";

const payload: RotationPayload = {
  updatedAt: Date.parse("2026-09-23T09:00:00.000Z"),
  source: "official",
  active: [{ slot: "a", mode: "brawlBall", map: "Beach Ball", startTime: null, endTime: null }],
  upcoming: [
    { slot: "b", mode: "soloShowdown", map: "Acid Lakes", startTime: null, endTime: null },
  ],
};

test("the map status separates the live event from the next one", () => {
  assert.equal(findMapEvent(payload, "Beach Ball")?.live, true);
  assert.equal(findMapEvent(payload, "Beach Ball")?.event.mode, "brawlBall");
  assert.equal(findMapEvent(payload, "Acid Lakes")?.live, false);
  assert.equal(findMapEvent(payload, "Nowhere"), null);
  assert.equal(findMapEvent(undefined, "Beach Ball"), null);
});

test("a window names the side it has, and an empty one says so", () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params?.when ? `${key} ${params.when}` : key;

  assert.equal(formatWindow(null, null, t), "maps.timeUnknown");
  assert.match(
    formatWindow("2026-09-23T09:00:00.000Z", "2026-09-23T11:00:00.000Z", t),
    /^\d{2}:\d{2} – \d{2}:\d{2}$/,
  );
  assert.ok(formatWindow(null, "2099-01-01T10:00:00.000Z", t).startsWith("maps.ends "));
});
