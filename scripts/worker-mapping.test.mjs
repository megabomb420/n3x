/**
 * The Worker's mapping layer is the only place the official Brawl Stars API
 * shapes meet the app's types, so it is the part worth pinning down. The
 * fixtures below follow the documented payloads (club object with `members`,
 * player object with `brawlers` + Ranked fields, battle log with
 * `soloRanked` / `teamRanked` queues and `TROPHYCHANGE`-style Elo deltas).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bareTag,
  diffRoster,
  mapBattles,
  mapClub,
  mapPlayer,
  mapRanking,
  mapRotation,
  plainName,
  tagPath,
} from "../worker/index.js";

const clubFixture = {
  tag: "#2JYGUQ2P8",
  name: "'N3X",
  description: "Invite only",
  type: "inviteOnly",
  badgeId: 8000001,
  requiredTrophies: 30000,
  trophies: 1234567,
  members: [
    {
      tag: "#AAA200JJJ",
      name: "Edu",
      nameColor: "0xff1ba5f5",
      role: "president",
      trophies: 114978,
      icon: { id: 28000123 },
    },
    { tag: "#CCC", name: "myby", role: "member", trophies: 139735 },
  ],
};

test("a club payload becomes the app's club, icons included", () => {
  const club = mapClub(clubFixture);
  assert.equal(club.tag, "2JYGUQ2P8");
  assert.equal(club.name, "'N3X");
  assert.equal(club.memberCount, 2);
  assert.equal(club.members[0].tag, "AAA200JJJ");
  assert.equal(club.members[0].iconId, 28000123);
  assert.match(String(club.members[0].iconUrl), /28000123\.png$/);
  assert.equal(club.members[1].iconUrl, null);
  assert.equal(typeof club.fetchedAt, "number");
});

test("the rotation splits into live and upcoming against the clock", () => {
  const entries = [
    {
      startTime: "20260922T080000.000Z",
      endTime: "20260923T080000.000Z",
      slotId: 3,
      event: { id: 1, mode: "gemGrab", modeId: 0, map: "Hard Rock Mine" },
    },
    {
      startTime: "20260922T180000.000Z",
      endTime: "20260923T180000.000Z",
      slotId: 4,
      event: { id: 2, mode: "hotZone", modeId: 17, map: "Under Pressure" },
    },
  ];
  const mapped = mapRotation(entries, Date.parse("2026-09-22T20:00:00.000Z"));
  assert.deepEqual(mapped.active, [
    {
      slot: "Slot 3",
      mode: "gemGrab",
      map: "Hard Rock Mine",
      startTime: "2026-09-22T08:00:00.000Z",
      endTime: "2026-09-23T08:00:00.000Z",
    },
    {
      slot: "Slot 4",
      mode: "hotZone",
      map: "Under Pressure",
      startTime: "2026-09-22T18:00:00.000Z",
      endTime: "2026-09-23T18:00:00.000Z",
    },
  ]);
  assert.equal(mapped.upcoming.length, 0, "both windows are live at 20:00");
  const early = mapRotation(entries, Date.parse("2026-09-22T07:00:00.000Z"));
  assert.equal(early.active.length, 0);
  assert.equal(early.upcoming.length, 2, "both windows are still ahead at 07:00");
  const finished = mapRotation(
    [{ startTime: "20260922T000000.000Z", endTime: "20260922T060000.000Z", slotId: 1, event: { mode: "heist", map: "Hot Potato" } }],
    Date.parse("2026-09-22T20:00:00.000Z"),
  );
  assert.equal(finished.active.length + finished.upcoming.length, 0, "a finished window is neither");
});

test("a player payload becomes the app's profile with Ranked fields", () => {
  const profile = mapPlayer(
    {
      tag: "#AAA200JJJ",
      name: "Edu",
      nameColor: "0xff1ba5f5",
      icon: { id: 28000123 },
      trophies: 51032,
      highestTrophies: 53152,
      expLevel: 359,
      "3vs3Victories": 49221,
      soloVictories: 802,
      duoVictories: 3005,
      rankedElo: 6120,
      rankedRank: 11,
      rankedRankName: "DIAMOND II",
      highestAllTimeRankedElo: 8300,
      highestAllTimeRankedRankName: "LEGENDARY II",
      club: { tag: "#2JYGUQ2P8", name: "'N3X" },
      brawlers: [
        { id: 16000000, name: "SHELLY", power: 9, rank: 30, trophies: 864, highestTrophies: 1006 },
        {
          id: 16000008,
          name: "NITA",
          power: 11,
          rank: 25,
          trophies: 1500,
          highestTrophies: 1600,
          hyperCharges: [{ id: 0, name: "Hyper" }],
        },
      ],
    },
    "president",
    "#2JYGUQ2P8",
  );
  assert.equal(profile.rankedElo, 6120);
  assert.equal(profile.rankedRankName, "DIAMOND II");
  assert.equal(profile.highestAllTimeRankedRankName, "LEGENDARY II");
  assert.equal(profile.victories3v3, 49221);
  assert.equal(profile.clubTag, "2JYGUQ2P8");
  assert.equal(profile.inClub, true);
  assert.equal(profile.clubRole, "president");
  assert.deepEqual(
    profile.brawlers.map((brawler) => brawler.name),
    ["NITA", "SHELLY"],
    "brawlers are ordered by trophies",
  );
  assert.equal(profile.brawlers[0].hyper, true);
  assert.equal(profile.brawlers[1].hyper, false);
  assert.equal(profile.brawlers[0].slug, "nita");
});

test("the battle log becomes the app's battle rows, Ranked queues included", () => {
  const battles = mapBattles(
    [
      {
        battleTime: "20260917T120000.000Z",
        event: { id: 15000025, mode: "brawlBall", map: "Triple Dribble" },
        battle: {
          mode: "brawlBall",
          type: "ranked",
          result: "victory",
          trophyChange: 8,
          teams: [
            [{ tag: "#AAA200JJJ", name: "Edu", brawler: { id: 16000008, name: "NITA", power: 11, trophies: 850 } }],
            [{ tag: "#ZZZ", name: "Other", brawler: { id: 16000000, name: "SHELLY" } }],
          ],
        },
      },
      {
        battleTime: "20260917T130000.000Z",
        event: { mode: "heist", map: "Hot Potato" },
        battle: {
          mode: "heist",
          type: "soloRanked",
          result: "defeat",
          trophyChange: -50,
          players: [{ tag: "#AAA200JJJ", name: "Edu", brawler: { id: 16000002, name: "BULL", trophies: 16 } }],
        },
      },
    ],
    "#AAA200JJJ",
  );
  assert.equal(battles.length, 2);
  assert.deepEqual(battles[0], {
    timestamp: "2026-09-17T12:00:00.000Z",
    ranked: false,
    result: "victory",
    victory: true,
    trophyChange: 8,
    mode: "brawlBall",
    map: "Triple Dribble",
    brawler: "NITA",
    brawlerTrophies: 850,
  });
  assert.equal(battles[1].ranked, true, "soloRanked is a Ranked queue");
  assert.equal(battles[1].victory, false);
  assert.equal(battles[1].brawlerTrophies, 16, "Ranked stores the league index in that field");
});

test("the API's colour markup is stripped from names", () => {
  assert.equal(plainName("<c7>Pikachu</c> Club"), "Pikachu Club");
  assert.equal(plainName("Heaven🍁"), "Heaven🍁");
  const rows = mapRanking("players", {
    items: [{ rank: 4, tag: "#X", name: "Mikee", trophies: 1, club: { name: "<c7>Pikachu</c>" } }],
  }).rows;
  assert.equal(rows[0].clubName, "Pikachu");
});

test("leaderboards keep the rank the API returned", () => {
  const players = mapRanking("players", {
    items: [{ rank: 1, tag: "#ABC", name: "Top", trophies: 100000, club: { name: "'N3X" } }],
  });
  assert.equal(players.type, "players");
  assert.deepEqual(players.rows[0], {
    rank: 1,
    tag: "ABC",
    name: "Top",
    trophies: 100000,
    clubName: "'N3X",
    memberCount: null,
  });
  const clubs = mapRanking("clubs", { items: [{ rank: 2, tag: "#CLUB", name: "Club", trophies: 900, memberCount: 30 }] });
  assert.equal(clubs.rows[0].memberCount, 30);
});

test("the roster diff reports joins, leaves and role changes", () => {
  const events = diffRoster(
    [
      { tag: "AAA", name: "Edu", role: "member" },
      { tag: "BBB", name: "Left", role: "member" },
    ],
    [
      { tag: "AAA", name: "Edu", role: "president" },
      { tag: "CCC", name: "New", role: "member" },
    ],
  );
  const kinds = events.map((event) => `${event.kind}:${event.playerTag}`).sort();
  assert.deepEqual(kinds, ["join:CCC", "leave:BBB", "role:AAA"]);
  assert.equal(events.find((event) => event.kind === "role").roleFrom, "member");
  assert.equal(events.find((event) => event.kind === "role").roleTo, "president");
});

test("tags and paths are normalised before they reach the API", () => {
  assert.equal(bareTag("#2jyguq2p8"), "2JYGUQ2P8");
  assert.equal(tagPath("/players", "#2JYGUQ2P8"), "/players/%232JYGUQ2P8");
});
