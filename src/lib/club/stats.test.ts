import assert from "node:assert/strict";
import test from "node:test";
import {
  LOW_SAMPLE,
  aggregateBattles,
  battlesOnMap,
  battlesWithoutResult,
  inQueue,
  recentBattles,
} from "./stats.ts";
import type { PlayerBattle } from "./types.ts";

function battle(overrides: Partial<PlayerBattle>): PlayerBattle {
  return {
    timestamp: "2026-09-22T12:00:00.000Z",
    type: "ranked",
    competitive: true,
    ranked: false,
    result: "victory",
    victory: true,
    trophyChange: 8,
    mode: "brawlBall",
    map: "Triple Dribble",
    brawler: "NITA",
    brawlerTrophies: 850,
    ...overrides,
  };
}

test("club meta counts only competitive battles and splits the queues", () => {
  const logs = [
    {
      tag: "AAA",
      battles: [
        battle({ brawler: "NITA" }),
        battle({ brawler: "NITA", result: "defeat", victory: false, trophyChange: -6 }),
        battle({ brawler: "SHELLY", type: "soloRanked", ranked: true, trophyChange: 80 }),
        battle({ brawler: "SHELLY", type: "friendly", competitive: false, trophyChange: 0 }),
        battle({
          brawler: "COLT",
          type: "",
          competitive: false,
          result: null,
          victory: null,
          trophyChange: null,
        }),
      ],
    },
    {
      tag: "BBB",
      battles: [
        battle({
          brawler: "NITA",
          type: "teamRanked",
          ranked: true,
          result: "defeat",
          victory: false,
          trophyChange: -40,
        }),
      ],
    },
  ];

  const all = aggregateBattles(logs, "all");
  assert.equal(all.battles, 4, "friendlies and event modes never enter club meta");
  assert.equal(all.wins, 2);
  assert.equal(all.members, 2);
  assert.deepEqual(all.totals, { all: 4, ladder: 2, ranked: 2 });
  assert.equal(all.windowStart, "2026-09-22T12:00:00.000Z");

  const nita = all.brawlers.find((row) => row.name === "NITA");
  assert.equal(nita?.picks, 3);
  assert.equal(nita?.wins, 1);
  assert.equal(nita?.trophyChange, 2, "only ladder battles carry trophies: 8 and -6");
  assert.equal(nita?.eloChange, -40, "the Ranked battle carries Elo, never added to trophies");
  assert.equal(nita?.trophyKnown, 2);
  assert.equal(nita?.eloKnown, 1);
  assert.equal(Math.round((nita?.winRate ?? 0) * 100), 33);

  const ladder = aggregateBattles(logs, "ladder");
  assert.equal(ladder.battles, 2);
  assert.deepEqual(
    ladder.brawlers.map((row) => row.name),
    ["NITA"],
  );
  assert.deepEqual(ladder.modes[0], {
    name: "brawlBall",
    picks: 2,
    wins: 1,
    winRate: 0.5,
    trophyChange: 2,
    eloChange: 0,
    trophyKnown: 2,
    eloKnown: 0,
  });
  assert.equal(ladder.maps[0]?.name, "Triple Dribble");

  const ranked = aggregateBattles(logs, "ranked");
  assert.equal(ranked.battles, 2);
  assert.deepEqual(
    ranked.brawlers.map((row) => row.name),
    ["SHELLY", "NITA"],
    "equal picks are ordered by win rate",
  );
  assert.equal(ranked.brawlers[0]?.eloChange, 80, "Ranked battles carry Elo, not trophies");
  assert.equal(ranked.brawlers[0]?.trophyChange, 0, "no ladder battle, no trophies");
});

test("a small sample is visible as a small sample, and an unpublished change is not a zero", () => {
  assert.equal(LOW_SAMPLE, 5);
  const meta = aggregateBattles(
    [
      {
        tag: "AAA",
        battles: [
          battle({ brawler: "COLT" }),
          battle({ brawler: "COLT", trophyChange: null, type: "soloRanked", ranked: true }),
        ],
      },
    ],
    "all",
  );
  const row = meta.brawlers[0];
  assert.equal(row?.picks, 2);
  assert.ok((row?.picks ?? 0) < LOW_SAMPLE);
  assert.equal(row?.trophyKnown, 1, "only one of the two battles published a trophy change");
  assert.equal(row?.trophyChange, 8, "the unpublished one is not silently counted as zero");
  assert.equal(row?.eloKnown, 0, "the Ranked battle published no Elo");
});

test("a member filter and a time range drop everyone and everything else", () => {
  const logs = [
    {
      tag: "AAA",
      battles: [
        battle({ timestamp: "2026-09-22T12:00:00.000Z", brawler: "NITA" }),
        battle({ timestamp: "2026-09-01T12:00:00.000Z", brawler: "COLT" }),
      ],
    },
    {
      tag: "BBB",
      battles: [battle({ timestamp: "2026-09-22T12:00:00.000Z", brawler: "SHELLY" })],
    },
  ];
  const now = Date.parse("2026-09-22T18:00:00.000Z");

  const one = aggregateBattles(logs, "all", { tag: "AAA", sinceMs: now - 7 * 86_400_000 });
  assert.equal(one.members, 1);
  assert.equal(one.battles, 1);
  assert.equal(one.brawlers[0]?.name, "NITA");
  assert.equal(one.windowStart, "2026-09-22T12:00:00.000Z");

  const missing = aggregateBattles(logs, "all", { tag: "ZZZ" });
  assert.equal(missing.battles, 0);
  assert.equal(missing.members, 0);
});

test("a map filter narrows the club to one map, and to the members who played it", () => {
  const logs = [
    {
      tag: "AAA",
      battles: [
        battle({ map: "Triple Dribble", brawler: "NITA" }),
        battle({
          map: "Triple Dribble",
          brawler: "COLT",
          result: "defeat",
          victory: false,
          trophyChange: -4,
        }),
        battle({ map: "Beach Ball", brawler: "SHELLY" }),
      ],
    },
    { tag: "BBB", battles: [battle({ map: "Beach Ball", brawler: "SHELLY" })] },
  ];

  const one = aggregateBattles(logs, "all", { map: "Triple Dribble" });
  assert.equal(one.battles, 2);
  assert.equal(one.members, 1, "only the member who played that map is counted");
  assert.equal(one.winRate, 0.5);
  assert.deepEqual(
    one.maps.map((row) => row.name),
    ["Triple Dribble"],
  );
  assert.deepEqual(one.brawlers.map((row) => row.name).sort(), ["COLT", "NITA"]);

  const none = aggregateBattles(logs, "all", { map: "Not A Map" });
  assert.equal(none.battles, 0);
  assert.equal(none.members, 0);
});

test("one map's battles come back newest first, friendlies and draws left out", () => {
  const logs = [
    {
      tag: "AAA",
      battles: [
        battle({ map: "Beach Ball", timestamp: "2026-09-22T10:00:00.000Z" }),
        battle({ map: "Beach Ball", timestamp: "2026-09-22T18:00:00.000Z" }),
        battle({
          map: "Beach Ball",
          timestamp: "2026-09-22T14:00:00.000Z",
          type: "friendly",
          competitive: false,
        }),
        battle({
          map: "Beach Ball",
          timestamp: "2026-09-22T16:00:00.000Z",
          result: null,
          victory: null,
        }),
        battle({ map: "Triple Dribble", timestamp: "2026-09-22T20:00:00.000Z" }),
      ],
    },
    { tag: "BBB", battles: [battle({ map: "Beach Ball", timestamp: "2026-09-22T12:00:00.000Z" })] },
  ];

  const rows = battlesOnMap(logs, "Beach Ball");
  assert.deepEqual(
    rows.map((row) => row.battle.timestamp),
    ["2026-09-22T18:00:00.000Z", "2026-09-22T12:00:00.000Z", "2026-09-22T10:00:00.000Z"],
  );
  assert.deepEqual(
    rows.map((row) => row.tag),
    ["AAA", "BBB", "AAA"],
  );
  assert.equal(
    battlesOnMap(logs, "Beach Ball", 1).length,
    1,
    "the limit is applied after the sort",
  );
  assert.equal(battlesOnMap(logs, "Not A Map").length, 0);
  assert.equal(
    battlesWithoutResult(logs, "Beach Ball"),
    1,
    "the Showdown-style game with no published result is counted separately, and the friendly is not",
  );
  assert.equal(battlesWithoutResult(logs, "Triple Dribble"), 0);
});

test("the club's own feed is the newest competitive battles across every member", () => {
  const logs = [
    {
      tag: "AAA",
      battles: [
        battle({ timestamp: "2026-09-22T12:00:00.000Z" }),
        battle({ timestamp: "2026-09-22T18:00:00.000Z", brawler: "COLT" }),
        battle({ timestamp: "2026-09-22T20:00:00.000Z", type: "friendly", competitive: false }),
      ],
    },
    {
      tag: "BBB",
      battles: [
        battle({
          timestamp: "2026-09-22T19:00:00.000Z",
          type: "soloRanked",
          ranked: true,
          result: null,
          victory: null,
        }),
        battle({ timestamp: "not a date" }),
      ],
    },
  ];

  const rows = recentBattles(logs, 25);
  assert.deepEqual(
    rows.map((row) => row.battle.timestamp),
    [
      "2026-09-22T19:00:00.000Z",
      "2026-09-22T18:00:00.000Z",
      "2026-09-22T12:00:00.000Z",
      "not a date",
    ],
    "newest first, a friendly left out, an unreadable timestamp last rather than first",
  );
  assert.deepEqual(
    rows.map((row) => row.tag),
    ["BBB", "AAA", "AAA", "BBB"],
    "each row names the member whose log it came from",
  );
  assert.equal(
    rows[0].battle.result,
    null,
    "a Showdown game is still a battle the club played; it just published no win or loss",
  );
  assert.equal(recentBattles(logs, 2).length, 2, "the limit is applied after the sort");
  assert.deepEqual(recentBattles([], 25), []);
});

test("the queue predicate is the one rule every club screen shares", () => {
  const ladder = battle({ ranked: false });
  const ranked = battle({ type: "soloRanked", ranked: true });

  assert.equal(inQueue(ladder, "all"), true);
  assert.equal(inQueue(ladder, "ladder"), true);
  assert.equal(inQueue(ladder, "ranked"), false);
  assert.equal(inQueue(ranked, "all"), true);
  assert.equal(inQueue(ranked, "ranked"), true);
  assert.equal(inQueue(ranked, "ladder"), false);
});
