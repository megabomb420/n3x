import assert from "node:assert/strict";
import test from "node:test";
import {
  countMentions,
  namesInTitle,
  otherVideos,
  pickLeadVideo,
  type CreatorVideo,
} from "./creator-math.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-22T12:00:00.000Z");

function video(overrides: Partial<CreatorVideo> & { daysAgo?: number }): CreatorVideo {
  const { daysAgo = 0, ...rest } = overrides;
  return {
    videoId: "v1",
    title: "A video",
    publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    watchUrl: "https://www.youtube.com/watch?v=v1",
    thumbnailUrl: "https://i.ytimg.com/vi/v1/mqdefault.jpg",
    kind: null,
    ...rest,
  };
}

test("a card leads with a recent tier list, not with yesterday's guide", () => {
  const guide = video({ videoId: "guide", title: "Explaining New Meta", kind: "meta", daysAgo: 1 });
  const tierList = video({ videoId: "tier", title: "Pro Tier List", kind: "tier list", daysAgo: 4 });
  assert.equal(pickLeadVideo([guide, tierList], "tierLists")?.videoId, "tier");

  const staleTierList = video({ videoId: "old", title: "Pro Tier List", kind: "tier list", daysAgo: 20 });
  assert.equal(
    pickLeadVideo([guide, staleTierList], "tierLists")?.videoId,
    "guide",
    "a three-week-old tier list does not outrank yesterday's meta video",
  );
  assert.equal(pickLeadVideo([video({ kind: null })], "tierLists"), null, "nothing tagged, nothing to lead with");
  assert.equal(pickLeadVideo([video({ kind: null, videoId: "raw" })], "everything")?.videoId, "raw");
});

test("other videos exclude the lead and honour the filter", () => {
  const lead = video({ videoId: "lead", kind: "tier list", daysAgo: 2 });
  const entries = [
    lead,
    video({ videoId: "second", kind: "tier list", daysAgo: 3 }),
    video({ videoId: "third", kind: "meta", daysAgo: 4 }),
    video({ videoId: "fourth", kind: "tier list", daysAgo: 5 }),
    video({ videoId: "raw", kind: null, daysAgo: 6 }),
  ];
  assert.deepEqual(
    otherVideos(entries, lead, "tierLists").map((entry) => entry.videoId),
    ["second", "third", "fourth"],
    "the lead and untagged uploads stay out",
  );
  assert.equal(otherVideos(entries, lead, "everything").length, 3, "the compact list is capped");
});

test("a mention is a whole word in a title, and short names do not count", () => {
  assert.deepEqual(namesInTitle("The Best 15 Brawlers To MAX OUT For Ranked!", ["Max", "Bo", "Shelly"]), ["Max"]);
  assert.deepEqual(namesInTitle("Flashy plays with Max", ["Ash"]), [], "no match inside a longer word");
  assert.deepEqual(namesInTitle("Ash ranks Ash", ["Ash"]), ["Ash"], "the name itself still matches");
});

test("mentions are counted inside the window, most named first", () => {
  const videos = [
    video({ videoId: "a", title: "Max is broken", daysAgo: 2 }),
    video({ videoId: "b", title: "Max and Shelly tier list", daysAgo: 5 }),
    video({ videoId: "c", title: "Max from last year", daysAgo: 90 }),
    video({ videoId: "d", title: "Shelly guide", daysAgo: 5 }),
  ];
  const counts = countMentions(videos, ["Max", "Shelly"], NOW - 30 * DAY);
  assert.deepEqual(counts, [
    { name: "Max", count: 2 },
    { name: "Shelly", count: 2 },
  ]);
  assert.equal(countMentions(videos, ["Max"], NOW - 1 * DAY).length, 0, "the window is respected");
  assert.equal(
    countMentions([video({ title: "Max today", daysAgo: 0 }), ...videos], ["Max"], NOW - 1 * DAY)[0]?.count,
    1,
    "a mention inside the window is counted",
  );
});
