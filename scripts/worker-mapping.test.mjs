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
  brawlMetricsSlug,
  classifyCreatorTitle,
  diffRoster,
  ladderCountry,
  looseKey,
  mapBattles,
  mapClub,
  mapPlayer,
  mapRanking,
  mapRotation,
  parseBrawlMetricsIndex,
  parseBrawlMetricsMapPage,
  parseBrawlMetricsTierList,
  parseCreatorFeed,
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
    [
      {
        startTime: "20260922T000000.000Z",
        endTime: "20260922T060000.000Z",
        slotId: 1,
        event: { mode: "heist", map: "Hot Potato" },
      },
    ],
    Date.parse("2026-09-22T20:00:00.000Z"),
  );
  assert.equal(
    finished.active.length + finished.upcoming.length,
    0,
    "a finished window is neither",
  );
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
          prestigeLevel: 3,
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
  assert.equal(profile.brawlers[0].prestige, 3, "prestige comes from the API's prestigeLevel");
  assert.equal(
    profile.brawlers[1].prestige,
    0,
    "a brawler the API publishes no prestige for reads as none",
  );
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
            [
              {
                tag: "#AAA200JJJ",
                name: "Edu",
                brawler: { id: 16000008, name: "NITA", power: 11, trophies: 850 },
              },
            ],
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
          players: [
            {
              tag: "#AAA200JJJ",
              name: "Edu",
              brawler: { id: 16000002, name: "BULL", trophies: 16 },
            },
          ],
        },
      },
    ],
    "#AAA200JJJ",
  );
  assert.equal(battles.length, 2);
  assert.deepEqual(battles[0], {
    timestamp: "2026-09-17T12:00:00.000Z",
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
  });
  assert.equal(battles[1].type, "soloRanked");
  assert.equal(battles[1].ranked, true, "soloRanked is a Ranked queue");
  assert.equal(battles[1].victory, false);
  assert.equal(battles[1].brawlerTrophies, 16, "Ranked stores the league index in that field");
});

test("creator titles classify, and a live stream is never a tier list", () => {
  assert.equal(classifyCreatorTitle("Ranking ALL Brawlers — Pro Tier List").kind, "tier list");
  assert.equal(classifyCreatorTitle("The NEW Meta Explained").kind, "meta");
  assert.equal(classifyCreatorTitle("Top 10 Best Brawlers").kind, "top picks");
  assert.equal(classifyCreatorTitle("LIVE: pushing trophies").kind, null);
  assert.equal(classifyCreatorTitle("a random vlog").kind, null);
  assert.ok(
    classifyCreatorTitle("Ranking ALL Brawlers — Pro Tier List").score >
      classifyCreatorTitle("My Tier List").score,
    "a full ranking outranks a vague tier list",
  );
});

test("a creator feed parses to entries, newest first, with links", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
    <entry>
      <yt:videoId>abc123</yt:videoId>
      <title>Ranking ALL Brawlers — Pro Tier List</title>
      <published>2026-09-20T10:00:00+00:00</published>
    </entry>
    <entry>
      <yt:videoId>def456</yt:videoId>
      <title>LIVE ranked grind &amp; chill</title>
      <published>2026-09-21T10:00:00+00:00</published>
    </entry>
  </feed>`;
  const entries = parseCreatorFeed(xml);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].videoId, "def456", "newest first");
  assert.equal(entries[0].kind, null);
  assert.equal(entries[1].kind, "tier list");
  assert.equal(entries[1].watchUrl, "https://www.youtube.com/watch?v=abc123");
  assert.match(entries[1].thumbnailUrl, /abc123/);
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
  const clubs = mapRanking("clubs", {
    items: [{ rank: 2, tag: "#CLUB", name: "Club", trophies: 900, memberCount: 30 }],
  });
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

test("a ladder region is a two-letter code or global, nothing else", () => {
  assert.equal(ladderCountry(null), "global");
  assert.equal(ladderCountry(" PL "), "pl");
  assert.equal(ladderCountry("global"), "global");
  assert.equal(ladderCountry("../players"), null);
  assert.equal(ladderCountry("poland"), null);
  assert.equal(mapRanking("players", { items: [] }, "pl").country, "pl");
});

test("a published tier list is read from the table, and a promo page is not one", () => {
  const html = `
    <tr data-class="Support" data-winrate="67.6" data-userate="0.81">
      <td><a class="tier-table-brawler" href="/brawlers/wendy"><span class="tier-table-avatar"></span>Wendy</a></td>
      <td><span class="tier-badge tier-splus">S+</span></td>
    </tr>
    <tr data-class="Tank" data-winrate="nope" data-userate="1"><td>skipped</td></tr>
    <tr><td>not a tier row</td></tr>`;
  const rows = parseBrawlMetricsTierList(html);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: "Wendy",
    tier: "S+",
    role: "Support",
    winRate: 67.6,
    useRate: 0.81,
  });
  assert.deepEqual(parseBrawlMetricsTierList("<p>Join the channel</p>"), []);
});

/** The publisher's own markup for one map page, shortened but not rewritten:
 *  values and keys sit in sibling spans, and React splits `0.7<!-- -->%`. */
const mapPageFixture = `
<div class="map-hero-metric map-hero-metric-battles"><span class="map-hero-metric-v">1,330,206</span><span class="map-hero-metric-k">Total Battles</span></div>
<div class="map-hero-metric map-hero-metric-updated"><span class="map-hero-metric-v">Sep 23, 2026, 3:03 PM</span><span class="map-hero-metric-k">Last Updated</span></div>
<h3 class="map-bucket-title">Best Picks</h3><p class="map-bucket-sub">High win rate and high use rate</p>
<div class="map-bucket-row"><a class="map-bucket-chip" href="/brawlers/rosa"><span class="map-bucket-name">Rosa</span><span class="map-bucket-stats"><b class="map-bucket-wr">75%</b><span class="map-bucket-ur">0.7<!-- -->%</span></span></a><a class="map-bucket-chip" href="/brawlers/bolt"><span class="map-bucket-name">Bolt</span><span class="map-bucket-stats"><b class="map-bucket-wr">73.1%</b><span class="map-bucket-ur">0.6<!-- -->%</span></span></a></div>
<h3 class="map-bucket-title">Not Recommended</h3><p class="map-bucket-sub">Low win and use rates</p>
<div class="map-bucket-row"><a class="map-bucket-chip" href="/brawlers/nita"><span class="map-bucket-name">Nita</span><span class="map-bucket-stats"><b class="map-bucket-wr">28.8%</b><span class="map-bucket-ur">3.4<!-- -->%</span></span></a></div>
<table class="tier-table"><thead><tr><th>Rank</th><th class="col-class">Class</th><th>Brawler</th><th class="col-tier" title="Tiers are assigned by percentile of the composite score: S+ top 2%, S next 6%, A next 15%, B next 27%, C next 30%, D bottom 20%.">Tier</th><th class="active-col" aria-sort="descending"><button type="button" class="stat-table-sort active">Win Rate<span aria-hidden="true">▼</span></button></th><th aria-sort="none"><button type="button" class="stat-table-sort">Use Rate</button></th></tr></thead><tbody>
<tr><td>1</td><td class="col-class"><span class="class-chip-static"><i class="classdot"></i>Tank</span></td><td><a class="tier-table-brawler" href="/brawlers/rosa"><span class="tier-table-avatar"></span>Rosa</a></td><td class="col-tier"><span class="tier-badge tier-a">A</span></td><td><span class="wr-cell">75<!-- -->%</span></td><td>0.7<!-- -->%</td></tr>
<tr><td>2</td><td class="col-class"><span class="class-chip-static"><i class="classdot"></i>Tank</span></td><td><a class="tier-table-brawler" href="/brawlers/bolt"><span class="tier-table-avatar"></span>Bolt</a></td><td class="col-tier"><span class="tier-badge tier-splus">S+</span></td><td><span class="wr-cell">73.1<!-- -->%</span></td><td>0.6<!-- -->%</td></tr>
</tbody></table>`;

/** A Showdown page: the same page shell, but its table ranks by placement. */
const showdownPageFixture = `
<div class="map-hero-metric map-hero-metric-battles"><span class="map-hero-metric-v">4,389,780</span><span class="map-hero-metric-k">Total Battles</span></div>
<div class="map-hero-metric map-hero-metric-updated"><span class="map-hero-metric-v">Sep 23, 2026, 3:45 PM<!-- --> UTC</span><span class="map-hero-metric-k">Last Updated</span></div>
<h3 class="map-bucket-title">Best Picks</h3><p class="map-bucket-sub">High top 4 rate and high use rate</p>
<div class="map-bucket-row"><a class="map-bucket-chip" href="/brawlers/rosa"><span class="map-bucket-name">Rosa</span><span class="map-bucket-stats"><b class="map-bucket-wr">78.4%</b><span class="map-bucket-ur">1.2<!-- -->%</span></span></a></div>
<table class="tier-table"><thead><tr><th>Rank</th><th class="col-class">Class</th><th>Brawler</th><th class="col-tier" title="Overall tier list, the same tier this brawler has on /tier-list/overall, not map-specific.">Tier</th><th class="col-games" aria-sort="none"><button type="button" class="stat-table-sort">Games</button></th><th aria-sort="none"><button type="button" class="stat-table-sort">Avg Rank</button></th><th class="col-first" aria-sort="none"><button type="button" class="stat-table-sort">1st Rate</button></th><th class="active-col" aria-sort="descending"><button type="button" class="stat-table-sort active">Top 4 Rate<span aria-hidden="true">▼</span></button></th></tr></thead><tbody>
<tr><td>1</td><td class="col-class"><span class="class-chip-static"><i class="classdot" style="background:var(--muted)"></i>Tank</span></td><td><a class="tier-table-brawler" href="/brawlers/rosa"><span class="tier-table-avatar"></span>Rosa</a></td><td class="col-tier"><span class="tier-badge tier-a">A</span></td><td class="col-games">42,735</td><td>#<!-- -->2.66</td><td class="col-first">61.5%</td><td>78.4<!-- -->%</td></tr>
</tbody></table>`;

test("a map page keeps the publisher's sample, buckets and rows apart", () => {
  const page = parseBrawlMetricsMapPage(mapPageFixture);
  assert.equal(page.sampleBattles, 1330206);
  assert.equal(page.updatedAt, "Sep 23, 2026, 3:03 PM");
  assert.equal(page.metric, "winRate");
  assert.deepEqual(
    page.buckets.map((bucket) => bucket.kind),
    ["picks", "notRecommended"],
  );
  assert.deepEqual(page.buckets[0].items[0], { name: "Rosa", winRate: 75, useRate: 0.7 });
  assert.deepEqual(
    page.rows[1],
    { name: "Bolt", tier: "S+", role: "Tank", winRate: 73.1, useRate: 0.6, games: null },
    "the split text nodes must not break a number, and class and tier are read",
  );
});

test("a Showdown page is read as placement, never relabelled a win rate", () => {
  const page = parseBrawlMetricsMapPage(showdownPageFixture);
  assert.equal(page.metric, "top4");
  assert.equal(page.sampleBattles, 4389780);
  assert.deepEqual(
    page.rows[0],
    { name: "Rosa", tier: "A", role: "Tank", winRate: 78.4, useRate: null, games: 42735 },
    "Showdown publishes top-4 rate and games, and no use rate",
  );
});

test("a page without a table parses to nothing, and the publisher's index names its own slugs", () => {
  assert.deepEqual(parseBrawlMetricsMapPage("<html></html>"), {
    sampleBattles: 0,
    updatedAt: null,
    metric: null,
    rows: [],
    buckets: [],
  });

  const index = parseBrawlMetricsIndex(`
    <div class="maps-grid">
      <a class="map-card is-not-live" href="/maps/solo-showdown/acid-lakes"><span class="map-card-frame"><img src="/Maps/15000956.webp"/></span><span class="map-card-name">Acid Lakes</span></a>
      <a class="map-card is-not-live" href="/maps/duo-showdown/acid-lakes"><span class="map-card-frame"><img src="/Maps/15000956.webp"/></span><span class="map-card-name">Acid Lakes</span></a>
    </div>`);
  assert.deepEqual(index, [
    { mode: "solo-showdown", map: "acid-lakes", name: "Acid Lakes" },
    { mode: "duo-showdown", map: "acid-lakes", name: "Acid Lakes" },
  ]);

  assert.equal(looseKey("Belle's Rock"), looseKey("Belles Rock"));
  assert.equal(brawlMetricsSlug("Solo Showdown"), "solo-showdown");
  assert.equal(brawlMetricsSlug("Belle's Rock"), "belles-rock");
});

test("tags and paths are normalised before they reach the API", () => {
  assert.equal(bareTag("#2jyguq2p8"), "2JYGUQ2P8");
  assert.equal(tagPath("/players", "#2JYGUQ2P8"), "/players/%232JYGUQ2P8");
});
