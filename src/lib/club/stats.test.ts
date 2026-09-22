import assert from "node:assert/strict";
import test from "node:test";
import { LOW_SAMPLE, aggregateBattles } from "./stats.ts";
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
        battle({ brawler: "COLT", type: "", competitive: false, result: null, victory: null, trophyChange: null }),
      ],
    },
    {
      tag: "BBB",
      battles: [battle({ brawler: "NITA", type: "teamRanked", ranked: true, result: "defeat", victory: false, trophyChange: -40 })],
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
  assert.equal(nita?.trophyChange, -38, "net trophies and Elo are summed, not averaged");
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
    changeKnown: 2,
  });
  assert.equal(ladder.maps[0]?.name, "Triple Dribble");

  const ranked = aggregateBattles(logs, "ranked");
  assert.equal(ranked.battles, 2);
  assert.deepEqual(
    ranked.brawlers.map((row) => row.name),
    ["SHELLY", "NITA"],
    "equal picks are ordered by win rate",
  );
  assert.equal(ranked.brawlers[0]?.trophyChange, 80, "Ranked battles carry Elo, not trophies");
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
  assert.equal(row?.changeKnown, 1, "only one of the two battles published a change");
  assert.equal(row?.trophyChange, 8, "the unpublished one is not silently counted as zero");
});
