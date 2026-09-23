/**
 * 'N3X backend — the hosted data layer the app talks to.
 *
 * brawltime.ninja answers every datacenter IP with a Cloudflare challenge
 * (verified 2026-09-22: Cloudflare Workers, GitHub/Azure runners, Vercel and
 * the jina relay are all 403 `cf-mitigated: challenge`), so the old design —
 * server functions parsing BTN HTML — can only ever work from a residential
 * connection. This Worker builds on the *official* Brawl Stars API instead,
 * which is not challenged and is the sanctioned source for exactly this data.
 *
 * `api.brawlstars.com` locks a key to whitelisted IPs and a Worker has no fixed
 * egress IP, so upstream calls go through RoyaleAPI's documented public proxy
 * (`bsproxy.royaleapi.dev`); the key whitelists *their* published IPs, not
 * ours.
 *
 *   GET /club                  roster, join/leave events (KV snapshot diff)
 *   GET /player/<tag>          profile, brawlers, ranked Elo, recent battles
 *   GET /ladder?type=players   official leaderboards (players | clubs)
 *   GET /maps                  live event rotation (mode + map)
 *   GET /health                what this deployment can reach
 *
 * Secrets: BRAWL_API_KEY (required). KV: DATA.
 */
const OFFICIAL_BASE = "https://api.brawlstars.com/v1";
const BROWSER_ICONS = "https://cdn.brawlify.com";
const CLUB_TTL_SECONDS = 45;
const PLAYER_TTL_SECONDS = 60;
const META_TTL_SECONDS = 900;
const EVENTS_KEPT = 40;
const MAX_REQUESTS_PER_MINUTE = 90;
/** Bumped when a mapper changes shape, so a deploy stops serving the old one. */
const CACHE_VERSION = "5";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const seen = new Map();

function limited(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((at) => now - at < 60_000);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5_000) seen.clear();
  return hits.length > MAX_REQUESTS_PER_MINUTE;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

export function bareTag(tag) {
  return String(tag ?? "")
    .replace(/^#/, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}

/** The upstream path for a tag, `#` encoded as the API requires. */
export function tagPath(prefix, tag) {
  return `${prefix}/%23${bareTag(tag)}`;
}

function profileIconUrl(id) {
  return Number.isFinite(id) ? `${BROWSER_ICONS}/profile-icons/regular/${id}.png` : null;
}

function isoFromBattleTime(value) {
  const raw = String(value ?? "");
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/.exec(raw);
  if (!match) return raw || new Date().toISOString();
  const [, y, mo, d, h, mi, s, ms] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

function num(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** The API wraps coloured name parts in `<cN>…</c>`; the app shows plain text. */
export function plainName(value) {
  return String(value ?? "")
    .replace(/<c\d*>/gi, "")
    .replace(/<\/c>/gi, "")
    .trim();
}

/** Official club payload → the app's ClubLive shape. */
export function mapClub(raw) {
  const members = Array.isArray(raw?.members) ? raw.members : [];
  return {
    tag: bareTag(raw?.tag),
    name: plainName(raw?.name).slice(0, 32),
    description: String(raw?.description ?? "").slice(0, 200),
    type: String(raw?.type ?? "inviteOnly"),
    badgeId: Number.isFinite(raw?.badgeId) ? raw.badgeId : null,
    requiredTrophies: num(raw?.requiredTrophies),
    trophies: num(raw?.trophies),
    memberCount: members.length,
    members: members
      .map((member) => {
        const iconId = num(member?.icon?.id, NaN);
        return {
          tag: bareTag(member?.tag),
          name: plainName(member?.name).slice(0, 32),
          nameColor: typeof member?.nameColor === "string" ? member.nameColor : null,
          role: String(member?.role ?? "member"),
          trophies: num(member?.trophies),
          iconId: Number.isFinite(iconId) ? iconId : null,
          iconUrl: profileIconUrl(iconId),
        };
      })
      .filter((member) => member.tag && member.name),
    fetchedAt: Date.now(),
  };
}

function snapshotOf(members) {
  return members.map((m) => ({ tag: m.tag, name: m.name, role: String(m.role) }));
}

/** Join / leave / role changes between two rosters. */
export function diffRoster(previous, next) {
  const before = new Map(previous.map((m) => [m.tag, m]));
  const after = new Map(next.map((m) => [m.tag, m]));
  const events = [];
  for (const [tag, member] of after) {
    if (!before.has(tag)) {
      events.push({
        kind: "join",
        playerTag: tag,
        playerName: member.name,
        roleFrom: null,
        roleTo: member.role,
      });
    }
  }
  for (const [tag, member] of before) {
    if (!after.has(tag)) {
      events.push({
        kind: "leave",
        playerTag: tag,
        playerName: member.name,
        roleFrom: member.role,
        roleTo: null,
      });
    }
  }
  for (const [tag, member] of after) {
    const old = before.get(tag);
    if (old && old.role !== member.role) {
      events.push({
        kind: "role",
        playerTag: tag,
        playerName: member.name,
        roleFrom: old.role,
        roleTo: member.role,
      });
    }
  }
  return events;
}

/** Official player payload → the app's PlayerProfile shape. */
export function mapPlayer(raw, clubRole = null, clubTag = "") {
  const iconId = num(raw?.icon?.id, NaN);
  const tag = bareTag(raw?.club?.tag);
  const brawlers = Object.values(raw?.brawlers ?? {}).map((brawler) => ({
    id: num(brawler?.id),
    slug: String(brawler?.name ?? "").toLowerCase(),
    name: String(brawler?.name ?? ""),
    power: num(brawler?.power),
    rank: num(brawler?.rank),
    /** Post-1,000-trophy progression; 0 means the brawler has not reached it. */
    prestige: num(brawler?.prestigeLevel),
    trophies: num(brawler?.trophies),
    highestTrophies: num(brawler?.highestTrophies),
    hyper: Array.isArray(brawler?.hyperCharges) && brawler.hyperCharges.length > 0,
  }));
  brawlers.sort((a, b) => b.trophies - a.trophies);
  return {
    tag: bareTag(raw?.tag),
    name: plainName(raw?.name) || "Player",
    nameColor: typeof raw?.nameColor === "string" ? raw.nameColor : null,
    iconId: Number.isFinite(iconId) ? iconId : null,
    iconUrl: profileIconUrl(iconId),
    trophies: num(raw?.trophies),
    highestTrophies: num(raw?.highestTrophies),
    expLevel: num(raw?.expLevel),
    rankedElo: Number.isFinite(raw?.rankedElo) ? raw.rankedElo : null,
    rankedRankName:
      typeof raw?.rankedRankName === "string"
        ? raw.rankedRankName
        : typeof raw?.rankedName === "string"
          ? raw.rankedName
          : null,
    highestAllTimeRankedElo: Number.isFinite(raw?.highestAllTimeRankedElo)
      ? raw.highestAllTimeRankedElo
      : null,
    highestAllTimeRankedRankName:
      typeof raw?.highestAllTimeRankedRankName === "string"
        ? raw.highestAllTimeRankedRankName
        : typeof raw?.highestAllTimeRankedName === "string"
          ? raw.highestAllTimeRankedName
          : null,
    victories3v3: num(raw?.["3vs3Victories"]),
    soloVictories: num(raw?.soloVictories),
    duoVictories: num(raw?.duoVictories),
    fameTierName: typeof raw?.fameTierName === "string" ? raw.fameTierName : null,
    clubTag: tag || null,
    clubName: raw?.club ? plainName(raw.club.name) || null : null,
    inClub: Boolean(tag) && tag === bareTag(clubTag),
    clubRole,
    brawlers,
    fetchedAt: Date.now(),
    source: "Supercell Brawl Stars API",
  };
}

/** One battle-log entry as a specific player lived it. */
function readBattle(item, playerTag) {
  const battle = item?.battle ?? {};
  const event = item?.event ?? {};
  const type = String(battle.type ?? "");
  const want = bareTag(playerTag);
  let brawler = null;
  let brawlerTrophies = null;
  for (const group of [battle.teams, battle.players]) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      for (const player of Array.isArray(entry) ? entry : [entry]) {
        if (bareTag(player?.tag) !== want) continue;
        brawler = typeof player?.brawler?.name === "string" ? player.brawler.name : null;
        brawlerTrophies = Number.isFinite(player?.brawler?.trophies)
          ? player.brawler.trophies
          : null;
      }
    }
  }
  const result = typeof battle.result === "string" ? battle.result : null;
  return {
    type,
    /** Ranked 2.0 queues; `ranked` is the trophy ladder, not Ranked mode. */
    ranked: type === "soloRanked" || type === "teamRanked",
    competitive: type === "ranked" || type === "soloRanked" || type === "teamRanked",
    result,
    victory: result === null ? null : result === "victory",
    trophyChange: Number.isFinite(battle.trophyChange) ? battle.trophyChange : null,
    mode:
      typeof event.mode === "string"
        ? event.mode
        : typeof battle.mode === "string"
          ? battle.mode
          : null,
    map: typeof event.map === "string" ? event.map : null,
    brawler,
    brawlerTrophies,
  };
}

/** Official battle log → the app's PlayerBattle list. */
export function mapBattles(items, playerTag) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const battle = readBattle(item, playerTag);
    out.push({
      timestamp: isoFromBattleTime(item?.battleTime),
      type: battle.type,
      competitive: battle.competitive,
      ranked: battle.ranked,
      result: battle.result,
      victory: battle.victory,
      trophyChange: battle.trophyChange,
      mode: battle.mode,
      map: battle.map,
      brawler: battle.brawler,
      brawlerTrophies: battle.brawlerTrophies,
    });
    if (out.length >= 25) break;
  }
  return out;
}

/** Two-letter region, or `global`. Anything else is rejected before it hits the path. */
export function ladderCountry(value) {
  const country = String(value ?? "global")
    .trim()
    .toLowerCase();
  return /^(global|[a-z]{2})$/.test(country) ? country : null;
}

/** Official leaderboard payload → a compact table for the Ladder tab. */
export function mapRanking(type, raw, country = "global") {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    type,
    country,
    updatedAt: Date.now(),
    rows: items.map((row) => ({
      rank: num(row?.rank),
      tag: bareTag(row?.tag),
      name: plainName(row?.name),
      trophies: num(row?.trophies),
      clubName: row?.club ? plainName(row.club.name) || null : null,
      memberCount: Number.isFinite(row?.memberCount) ? row.memberCount : null,
    })),
  };
}

async function upstream(env, path, accept = "application/json") {
  const base = (env.UPSTREAM_BASE ?? OFFICIAL_BASE).replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${env.BRAWL_API_KEY ?? ""}`, accept },
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}

/** Upstream error → an honest HTTP status for the app (token problems included). */
function upstreamFailure(status, body) {
  let reason = "";
  try {
    reason = String(JSON.parse(body)?.reason ?? "");
  } catch {
    reason = String(body ?? "").slice(0, 120);
  }
  if (status === 403) return json({ error: "upstream-denied", reason }, 503);
  if (status === 404) return json({ error: "not-found" }, 404);
  return json({ error: "upstream", status, reason }, 502);
}

function upstreamUnavailable(err) {
  return json({ error: "upstream-unreachable", message: String(err?.message ?? err) }, 502);
}

async function cached(request, ctx, ttlSeconds, produce) {
  if (request.method !== "GET") return produce();
  const cache = caches.default;
  const key = new Request(
    `${request.url}${request.url.includes("?") ? "&" : "?"}v=${CACHE_VERSION}`,
  );
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await produce();
  if (res.status === 200) {
    const stored = new Response(res.clone().body, res);
    stored.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
    ctx.waitUntil(cache.put(key, stored));
  }
  return res;
}

async function readEvents(env) {
  const raw = await env.DATA.get("events:club");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Store the roster snapshot, append whatever changed, return the visible log. */
async function recordRoster(env, club) {
  const nextSnap = snapshotOf(club.members);
  const nextJson = JSON.stringify(nextSnap);
  const stored = await env.DATA.get("snapshot:club");
  if (!stored) {
    await env.DATA.put("snapshot:club", nextJson);
    return { events: [], baseline: true, tracking: true };
  }
  // KV's free tier allows 1000 writes/day; an unchanged roster must not spend one.
  if (stored === nextJson) {
    return { events: await readEvents(env), baseline: false, tracking: true };
  }
  const changes = diffRoster(JSON.parse(stored), nextSnap);
  const now = Date.now();
  const events = await readEvents(env);
  const appended = changes.map((change, index) => ({
    ...change,
    id: now + index,
    occurredAt: new Date(now).toISOString(),
  }));
  const merged = [...appended.reverse(), ...events].slice(0, EVENTS_KEPT);
  if (appended.length > 0) await env.DATA.put("events:club", JSON.stringify(merged));
  await env.DATA.put("snapshot:club", nextJson);
  return { events: merged, baseline: false, tracking: true };
}

async function loadClub(env) {
  const res = await upstream(env, tagPath("/clubs", env.CLUB_TAG));
  if (!res.ok) return { failure: upstreamFailure(res.status, res.body) };
  return { club: mapClub(JSON.parse(res.body)) };
}

async function handleClub(request, env, ctx) {
  return cached(request, ctx, CLUB_TTL_SECONDS, async () => {
    let loaded;
    try {
      loaded = await loadClub(env);
    } catch (err) {
      return upstreamUnavailable(err);
    }
    if (loaded.failure) return loaded.failure;
    const club = loaded.club;
    const recorded = await recordRoster(env, club);
    return json({
      club,
      events: recorded.events,
      baseline: recorded.baseline,
      tracking: recorded.tracking,
      source: "Supercell Brawl Stars API",
      fetchedAt: club.fetchedAt,
    });
  });
}

async function handlePlayer(request, env, ctx, tag) {
  return cached(request, ctx, PLAYER_TTL_SECONDS, async () => {
    try {
      const profile = await upstream(env, tagPath("/players", tag));
      if (!profile.ok) return upstreamFailure(profile.status, profile.body);
      const log = await upstream(env, `${tagPath("/players", tag)}/battlelog`);
      let role = null;
      const club = await loadClub(env);
      if (club.club) {
        const member = club.club.members.find((m) => m.tag === bareTag(tag));
        role = member?.role ?? null;
      }
      const battles = log.ok ? mapBattles(JSON.parse(log.body).items, tag) : [];
      return json({ ...mapPlayer(JSON.parse(profile.body), role, env.CLUB_TAG), battles });
    } catch (err) {
      return upstreamUnavailable(err);
    }
  });
}

async function handleLadder(request, env, ctx) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "clubs" ? "clubs" : "players";
  const country = ladderCountry(url.searchParams.get("country"));
  if (!country) return json({ error: "unknown region" }, 400);
  return cached(request, ctx, META_TTL_SECONDS, async () => {
    try {
      const res = await upstream(env, `/rankings/${country}/${type}?limit=200`);
      if (!res.ok) return upstreamFailure(res.status, res.body);
      return json(mapRanking(type, JSON.parse(res.body), country));
    } catch (err) {
      return upstreamUnavailable(err);
    }
  });
}

/**
 * The rotation endpoint answers with a bare array of
 * `{ startTime, endTime, slotId, event: { mode, map } }` — no active/upcoming
 * split, so it is made here against the clock.
 */
export function mapRotation(entries, now = Date.now()) {
  const startsAt = (event) => (event.startTime ? Date.parse(event.startTime) : 0);
  const endsAt = (event) => (event.endTime ? Date.parse(event.endTime) : Number.POSITIVE_INFINITY);
  const events = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      slot: Number.isFinite(entry?.slotId) ? `Slot ${entry.slotId}` : "",
      mode: String(entry?.event?.mode ?? ""),
      map: String(entry?.event?.map ?? ""),
      startTime: entry?.startTime ? isoFromBattleTime(entry.startTime) : null,
      endTime: entry?.endTime ? isoFromBattleTime(entry.endTime) : null,
    }))
    .filter((event) => event.mode || event.map);
  return {
    updatedAt: now,
    active: events
      .filter((event) => startsAt(event) <= now && endsAt(event) > now)
      .sort((a, b) => a.slot.localeCompare(b.slot, undefined, { numeric: true })),
    upcoming: events
      .filter((event) => startsAt(event) > now)
      .sort((a, b) => startsAt(a) - startsAt(b)),
    source: "Supercell Brawl Stars API",
  };
}

const BATTLELOG_TTL_SECONDS = 300;

/**
 * One member's recent battles, ready for the app to aggregate.
 *
 * The aggregation itself runs in the browser: a Worker invocation may only make
 * so many subrequests (a batch of 28 battle logs is already over the free-plan
 * ceiling), while 28 separate invocations — one per member — are each a single
 * upstream call and the app caches them per tag.
 */
async function handleBattles(request, env, ctx, tag) {
  return cached(request, ctx, BATTLELOG_TTL_SECONDS, async () => {
    try {
      const res = await upstream(env, `${tagPath("/players", tag)}/battlelog`);
      if (!res.ok) return upstreamFailure(res.status, res.body);
      const items = JSON.parse(res.body).items ?? [];
      return json({ tag: bareTag(tag), battles: mapBattles(items, tag), sampledAt: Date.now() });
    } catch (err) {
      return upstreamUnavailable(err);
    }
  });
}

const CREATORS = [
  { id: "spenlc", name: "SpenLC", handle: "@spenlc", channelId: "UCsuS8BRN4y6_QoBvAqTtSSg" },
  { id: "ash", name: "Ash", handle: "@ashbrawlstars", channelId: "UC874WmmCVtIwTG4gQbWHKUQ" },
  {
    id: "kairos",
    name: "KairosTime",
    handle: "@kairosgaming",
    channelId: "UCmG2EhfOwSjpPMX4LjGY__A",
  },
  {
    id: "cryingman",
    name: "CryingMan",
    handle: "@cryingman",
    channelId: "UCGShu88Lh2ZAtXX0qbV9fXA",
  },
  { id: "rey", name: "Rey", handle: "@ReyBrawlStars", channelId: "UCUZks0tPvD_ZbNwtBzyR_JQ" },
  { id: "lex", name: "Lex", handle: "@LexBrawlStars", channelId: "UC4yh9rj_cPT77it63N14HQg" },
  { id: "bobby", name: "bobby", handle: "@bobbybrawlstars", channelId: "UCcvJdy945lh9KNQnW2yr_0A" },
];
const CREATORS_TTL_SECONDS = 1800;
/** The channel index is tiny and decides what exists, so it refreshes sooner. */
const CREATORS_INDEX_TTL_SECONDS = 300;
const CHANNEL_ENTRIES_KEPT = 12;
/** The last good reading of a channel outlives its cache, for rate-limited days. */
const LAST_GOOD_TTL_SECONDS = 6 * 60 * 60;
const lastGoodKey = (id) =>
  new Request(`https://relay.invalid/channel-last/${id}?v=${CACHE_VERSION}`);
const channelKvKey = (id) => `channel:${id}`;

/**
 * Refresh one channel and keep the reading in KV.
 *
 * YouTube throttles the shared edge addresses (a feed that answers 200 from a
 * home connection returns 429 from here), so the feeds are warmed a channel at a
 * time on a schedule instead of all seven on a page view, and every good reading
 * is kept for six hours: a throttled refresh then shows the previous reading,
 * labelled, rather than an empty card.
 */
async function warmChannel(env, index = null) {
  const slot = index ?? Math.floor(Date.now() / (15 * 60 * 1000)) % CREATORS.length;
  const creator = CREATORS[slot];
  try {
    const entries = await creatorFeed(creator.channelId);
    const payload = {
      ...creatorIndexEntry(creator),
      fetchedAt: Date.now(),
      entries: entries.slice(0, CHANNEL_ENTRIES_KEPT),
    };
    await env.DATA.put(channelKvKey(creator.id), JSON.stringify(payload), {
      expirationTtl: LAST_GOOD_TTL_SECONDS,
    });
    return { id: creator.id, entries: payload.entries.length };
  } catch (err) {
    return { id: creator.id, error: String(err?.message ?? err) };
  }
}

function creatorById(id) {
  return CREATORS.find((creator) => creator.id === id || creator.channelId === id) ?? null;
}

function creatorIndexEntry(creator) {
  return {
    id: creator.id,
    name: creator.name,
    handle: creator.handle,
    channelUrl: `https://www.youtube.com/channel/${creator.channelId}`,
  };
}

/**
 * One creator's recent uploads, classified by title.
 *
 * One channel per invocation: a Worker invocation may only make so many
 * subrequests, so the app asks per channel (and caches each) instead of the
 * backend pulling seven feeds in one go. A failed refresh falls back to the last
 * good reading, labelled as such, rather than blanking the card.
 */
async function handleCreatorChannel(request, env, ctx, id) {
  const creator = creatorById(id);
  if (!creator) return json({ error: "not found" }, 404);
  return cached(request, ctx, CREATORS_TTL_SECONDS, async () => {
    const base = creatorIndexEntry(creator);
    try {
      const entries = await creatorFeed(creator.channelId);
      const payload = {
        ...base,
        fetchedAt: Date.now(),
        entries: entries.slice(0, CHANNEL_ENTRIES_KEPT),
      };
      ctx.waitUntil(
        caches.default.put(
          lastGoodKey(creator.id),
          new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json",
              "cache-control": `public, max-age=${LAST_GOOD_TTL_SECONDS}`,
            },
          }),
        ),
      );
      return json(payload);
    } catch (err) {
      const message = String(err?.message ?? err);
      // KV survives colos and isolates; the per-colo cache is the second choice.
      const stored = await env.DATA.get(channelKvKey(creator.id));
      if (stored) {
        try {
          return json({ ...JSON.parse(stored), stale: true, error: message });
        } catch {
          /* fall through to the cache */
        }
      }
      const stale = await caches.default.match(lastGoodKey(creator.id));
      if (stale) {
        const payload = await stale.json();
        return json({ ...payload, stale: true, error: message });
      }
      return json({ ...base, fetchedAt: Date.now(), entries: [], error: message });
    }
  });
}

/** Which creator channels this build knows about. */
async function handleCreators(request, env, ctx) {
  return cached(request, ctx, CREATORS_INDEX_TTL_SECONDS, async () =>
    json({
      updatedAt: Date.now(),
      source: "YouTube RSS",
      creators: CREATORS.map(creatorIndexEntry),
    }),
  );
}

/** Tier-list and meta uploads, recognised by title. A live stream is never one. */
export function classifyCreatorTitle(title) {
  const t = String(title ?? "").toLowerCase();
  if (/\blive\b/.test(t) || /stream ends/.test(t)) return { score: 0, kind: null };
  if (/tier list/.test(t) && /rank(ing|s)? all|worst to best|pro tier/.test(t))
    return { score: 100, kind: "tier list" };
  if (/pro tier list|best & worst/.test(t)) return { score: 95, kind: "tier list" };
  if (/tier list/.test(t)) return { score: 90, kind: "tier list" };
  if (/ranking all|ranks all/.test(t)) return { score: 85, kind: "tier list" };
  if (/explaining new meta|new meta/.test(t)) return { score: 70, kind: "meta" };
  if (/top 10 best brawlers|best 15 brawlers|must max brawlers/.test(t))
    return { score: 55, kind: "top picks" };
  return { score: 0, kind: null };
}

/** A YouTube Atom feed's entries, newest first, with what the screen shows. */
export function parseCreatorFeed(xml) {
  const decode = (value) =>
    String(value ?? "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
  const tag = (block, name) => {
    const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
    return match ? decode(match[1]) : "";
  };
  const entries = [];
  for (const chunk of String(xml ?? "").match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []) {
    const videoId = tag(chunk, "yt:videoId");
    const title = tag(chunk, "title");
    const publishedAt = tag(chunk, "published");
    if (!videoId || !title || !publishedAt) continue;
    entries.push({
      videoId,
      title,
      publishedAt,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      kind: classifyCreatorTitle(title).kind,
    });
  }
  return entries.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function creatorFeed(channelId, attempt = 0) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    headers: {
      accept: "application/atom+xml, application/xml, text/xml",
      "user-agent": "n3x-club-companion",
    },
  });
  // YouTube throttles the shared edge addresses now and then; one short retry
  // keeps a rate-limited card from going empty for the rest of its cache window.
  if (res.status === 429 && attempt === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return creatorFeed(channelId, attempt + 1);
  }
  if (!res.ok) throw new Error(`feed ${res.status}`);
  return parseCreatorFeed(await res.text());
}

const TIER_LIST_TTL_SECONDS = 900;
const TIER_SOURCES = {
  overall: "https://brawlmetrics.gg/tier-list",
  ranked: "https://brawlmetrics.gg/tier-list/ranked",
};

/**
 * BrawlMetrics publishes the board as an HTML table. Tiers are percentiles of a
 * composite of win rate and use rate — read from the row, never invented here.
 */
export function parseBrawlMetricsTierList(html) {
  const rows = [];
  const chunks = String(html ?? "").match(/<tr\b[^>]*\bdata-winrate="[^"]+"[\s\S]*?<\/tr>/gi) ?? [];
  for (const chunk of chunks) {
    const attr = (name) => {
      const match = new RegExp(`\\bdata-${name}="([^"]*)"`, "i").exec(chunk);
      return match ? match[1] : "";
    };
    const tier = (/class="tier-badge[^"]*"[^>]*>([^<]+)/i.exec(chunk)?.[1] ?? "").trim();
    const name = (/class="tier-table-brawler"[\s\S]*?<\/span>([^<]+)/i.exec(chunk)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const winRate = Number(attr("winrate"));
    const useRate = Number(attr("userate"));
    if (!name || !tier || !Number.isFinite(winRate)) continue;
    rows.push({
      name,
      tier,
      role: attr("class") || null,
      winRate,
      useRate: Number.isFinite(useRate) ? useRate : null,
    });
  }
  return rows;
}

async function readTierPayload(env, scope) {
  const stored = await env.DATA.get(`tier:${scope}`).catch(() => null);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Re-read one scope from the publisher and keep it. The board is not a snapshot. */
async function refreshTierList(env, scope) {
  const sourceUrl = TIER_SOURCES[scope];
  const res = await fetch(sourceUrl, {
    headers: {
      accept: "text/html",
      "user-agent": "Mozilla/5.0 (compatible; n3x-club-companion)",
    },
  });
  if (!res.ok) throw new Error(`tier list ${res.status}`);
  const rows = parseBrawlMetricsTierList(await res.text());
  if (rows.length < 10) throw new Error("tier list did not parse");
  const payload = { scope, source: "BrawlMetrics", sourceUrl, updatedAt: Date.now(), rows };
  await env.DATA.put(`tier:${scope}`, JSON.stringify(payload), { expirationTtl: 7 * 24 * 60 * 60 });
  return payload;
}

function tierFresh(payload) {
  return payload?.updatedAt && Date.now() - payload.updatedAt < TIER_LIST_TTL_SECONDS * 1000;
}

async function handleTierList(request, env, ctx) {
  const scope = new URL(request.url).searchParams.get("scope") === "ranked" ? "ranked" : "overall";
  return cached(request, ctx, TIER_LIST_TTL_SECONDS, async () => {
    const stored = await readTierPayload(env, scope);
    if (tierFresh(stored)) return json(stored);
    try {
      return json(await refreshTierList(env, scope));
    } catch (err) {
      const message = String(err?.message ?? err);
      if (stored?.rows?.length) return json({ ...stored, stale: true, error: message });
      return json({ error: "tier-list-unavailable", message, scope, rows: [] }, 502);
    }
  });
}

/** Both scopes, so a quiet day still picks up a publisher update. */
async function warmTierLists(env) {
  const results = [];
  for (const scope of Object.keys(TIER_SOURCES)) {
    try {
      const payload = await refreshTierList(env, scope);
      results.push({ scope, rows: payload.rows.length });
    } catch (err) {
      results.push({ scope, error: String(err?.message ?? err) });
    }
  }
  return results;
}

const BM_BASE = "https://brawlmetrics.gg";
const MAP_STATS_TTL_SECONDS = 900;
const BM_INDEX_TTL_SECONDS = 6 * 60 * 60;
const BM_HEADERS = {
  accept: "text/html",
  "user-agent": "Mozilla/5.0 (compatible; n3x-club-companion)",
};

/** `Brawl Ball` → `brawl-ball`; diacritics and punctuation never reach a URL. */
export function brawlMetricsSlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Comparison key that ignores case, spaces and punctuation: `Belle's Rock` = `Belles Rock`. */
export function looseKey(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Every map the publisher lists, from its own index: the index is the only
 * authority on slugs (`belles-rock` 404s, `acid-lakes` serves three Showdowns),
 * so the Worker resolves names through it instead of guessing a URL.
 */
export function parseBrawlMetricsIndex(html) {
  const out = new Map();
  const re = /<a\b[^>]*href="\/maps\/([a-z0-9-]+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html ?? "").matchAll(re)) {
    // A card carries its name in `map-card-name`; anything else falls back to its text.
    const name = (
      /class="map-card-name">([^<]+)</i.exec(match[3])?.[1] ??
      match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
    ).trim();
    if (!name) continue;
    out.set(`${match[1]}/${match[2]}`, { mode: match[1], map: match[2], name });
  }
  return [...out.values()];
}

/** A cell's text, tags and spacing gone. */
function tagText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `42,735` → 42735, `78.4%` → 78.4, anything else → null. */
function cellNumber(value) {
  if (value == null) return null;
  const number = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : null;
}

/**
 * One map page: the publisher's sample size, its update stamp, its four buckets
 * and its full table. Numbers are read, never derived.
 *
 * The publisher ranks by two different figures and the table says which one:
 * an ordinary mode publishes a Win Rate, while Showdown, which has no win or
 * loss, publishes a Top 4 Rate (with games and average rank instead of a use
 * rate). The header is therefore read first — a placement table is never
 * relabelled a win rate.
 */
export function parseBrawlMetricsMapPage(html) {
  // React splits text nodes with `<!-- -->`, so `0.7<!-- -->%` is one number.
  const source = String(html ?? "").replace(/<!-- -->/g, "");

  const metric = (label) => {
    const re = new RegExp(
      `class="map-hero-metric-v">([^<]+)</span>[\\s\\S]{0,80}?class="map-hero-metric-k"[^>]*>${label}<`,
      "i",
    );
    return re.exec(source)?.[1]?.trim() ?? null;
  };
  const battles = Number((metric("Total Battles") ?? "").replace(/[^\d]/g, ""));

  const labels = [
    ...(/<thead>[\s\S]*?<\/thead>/i.exec(source)?.[0] ?? "").matchAll(
      /<th[^>]*>([\s\S]*?)<\/th>/gi,
    ),
  ].map((match) => tagText(match[1]).replace(/[▲▼]/g, "").trim());
  const metricKind = labels.includes("Win Rate")
    ? "winRate"
    : labels.includes("Top 4 Rate")
      ? "top4"
      : null;

  const rows = [];
  const body = metricKind ? (/<tbody>([\s\S]*?)<\/tbody>/i.exec(source)?.[1] ?? "") : "";
  for (const chunk of body.match(/<tr>[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      tagText(match[1]),
    );
    const cell = (label) => {
      const at = labels.indexOf(label);
      return at < 0 ? null : cells[at] || null;
    };
    const name = cell("Brawler");
    const winRate = cellNumber(cell(metricKind === "top4" ? "Top 4 Rate" : "Win Rate"));
    if (!name || winRate == null) continue;
    rows.push({
      name,
      tier: cell("Tier") ?? "?",
      role: cell("Class"),
      winRate,
      useRate: cellNumber(cell("Use Rate")),
      games: cellNumber(cell("Games")),
    });
  }

  const kinds = {
    "best picks": "picks",
    winners: "winners",
    "most used": "mostUsed",
    "not recommended": "notRecommended",
  };
  const buckets = [];
  const bucketRe =
    /<h3[^>]*>([^<]+)<\/h3>[\s\S]{0,600}?<div class="map-bucket-row">([\s\S]{0,6000}?)<\/div>/gi;
  for (const match of source.matchAll(bucketRe)) {
    const title = match[1].trim();
    const items = [
      ...match[2].matchAll(
        /class="map-bucket-name">([^<]+)<[\s\S]{0,400}?class="map-bucket-wr">([\d.]+)%[\s\S]{0,200}?class="map-bucket-ur">([\d.]+)%/gi,
      ),
    ].map((x) => ({ name: x[1].trim(), winRate: Number(x[2]), useRate: Number(x[3]) }));
    if (items.length) buckets.push({ kind: kinds[title.toLowerCase()] ?? "other", title, items });
  }

  return {
    sampleBattles: Number.isFinite(battles) ? battles : 0,
    updatedAt: metric("Last Updated"),
    metric: metricKind,
    rows,
    buckets,
  };
}

async function readBmIndex(env) {
  const stored = await env.DATA.get("bm-index").catch(() => null);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.entries?.length && Date.now() - parsed.fetchedAt < BM_INDEX_TTL_SECONDS * 1000)
        return parsed;
    } catch {
      /* corrupt store — refetch below */
    }
  }
  const res = await fetch(`${BM_BASE}/maps`, { headers: BM_HEADERS });
  if (!res.ok) throw new Error(`map index ${res.status}`);
  const entries = parseBrawlMetricsIndex(await res.text());
  if (entries.length < 20) throw new Error("map index did not parse");
  const payload = { fetchedAt: Date.now(), entries };
  await env.DATA.put("bm-index", JSON.stringify(payload), { expirationTtl: 7 * 24 * 60 * 60 });
  return payload;
}

/** The publisher's entry for a map, preferring the mode it was asked about. */
async function resolveMapEntry(env, map, mode) {
  const guess = { mode: brawlMetricsSlug(mode), map: brawlMetricsSlug(map), name: map };
  let index;
  try {
    index = await readBmIndex(env);
  } catch {
    return guess;
  }
  const wanted = looseKey(map);
  const candidates = index.entries.filter((entry) => looseKey(entry.name) === wanted);
  if (!candidates.length) return guess;
  const wantedMode = brawlMetricsSlug(mode);
  return candidates.find((entry) => entry.mode === wantedMode) ?? candidates[0];
}

/**
 * One map's published numbers. The app cannot compute a global win rate from the
 * official API, so this is the publisher's own count, with its sample size and
 * its date, kept for a week so a throttled fetch still answers.
 */
async function handleMapStats(request, env, ctx) {
  const url = new URL(request.url);
  const map = String(url.searchParams.get("map") ?? "").trim();
  const mode = String(url.searchParams.get("mode") ?? "").trim();
  if (!map) return json({ error: "bad-request", message: "map is required" }, 400);
  return cached(request, ctx, MAP_STATS_TTL_SECONDS, async () => {
    const entry = await resolveMapEntry(env, map, mode);
    const key = `mapstats:${entry.mode}/${entry.map}`;
    const sourceUrl = `${BM_BASE}/maps/${entry.mode}/${entry.map}`;
    try {
      const res = await fetch(sourceUrl, { headers: BM_HEADERS });
      if (!res.ok) throw new Error(`map page ${res.status}`);
      const parsed = parseBrawlMetricsMapPage(await res.text());
      if (parsed.rows.length < 5) throw new Error("map page did not parse");
      const payload = {
        map: entry.name,
        mode: mode || null,
        source: "BrawlMetrics",
        sourceUrl,
        fetchedAt: Date.now(),
        ...parsed,
      };
      await env.DATA.put(key, JSON.stringify(payload), { expirationTtl: 7 * 24 * 60 * 60 });
      return json(payload);
    } catch (err) {
      const message = String(err?.message ?? err);
      const stored = await env.DATA.get(key).catch(() => null);
      if (stored) {
        try {
          return json({ ...JSON.parse(stored), stale: true, error: message });
        } catch {
          /* corrupt store — fall through to the honest error */
        }
      }
      return json(
        { error: "map-stats-unavailable", message, map, mode: mode || null, rows: [], buckets: [] },
        502,
      );
    }
  });
}

async function handleMaps(request, env, ctx) {
  return cached(request, ctx, META_TTL_SECONDS, async () => {
    try {
      const res = await upstream(env, "/events/rotation");
      if (!res.ok) return upstreamFailure(res.status, res.body);
      return json(mapRotation(JSON.parse(res.body)));
    } catch (err) {
      return upstreamUnavailable(err);
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (path === "/__warm") {
      if (request.headers.get("x-register-key") !== env.REGISTER_KEY)
        return json({ error: "forbidden" }, 403);
      const index = Number(url.searchParams.get("index"));
      return json(
        await warmChannel(
          env,
          Number.isInteger(index) && index >= 0 && index < CREATORS.length ? index : null,
        ),
      );
    }
    if (limited(request.headers.get("cf-connecting-ip") ?? "unknown")) {
      return json({ error: "too many requests" }, 429);
    }
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405);

    if (path === "/health") {
      return json({
        ok: true,
        key: Boolean(env.BRAWL_API_KEY),
        upstream: env.UPSTREAM_BASE ?? OFFICIAL_BASE,
        club: env.CLUB_TAG ?? null,
      });
    }
    if (path === "/club") return handleClub(request, env, ctx);
    if (path === "/creators") return handleCreators(request, env, ctx);

    const channel = /^\/creators\/([a-z0-9-]{2,32})$/.exec(path);
    if (channel) return handleCreatorChannel(request, env, ctx, channel[1]);
    if (path === "/ladder") return handleLadder(request, env, ctx);
    if (path === "/tier-list") return handleTierList(request, env, ctx);
    if (path === "/maps") return handleMaps(request, env, ctx);
    if (path === "/map-stats") return handleMapStats(request, env, ctx);

    const battles = /^\/battles\/([0-9A-Za-z]{3,16})$/.exec(path);
    if (battles) return handleBattles(request, env, ctx, battles[1]);

    const player = /^\/player\/([0-9A-Za-z]{3,16})$/.exec(path);
    if (player) return handlePlayer(request, env, ctx, player[1]);

    return json({ error: "not found" }, 404);
  },

  /** One creator channel per run, and both tier-list scopes, so Meta does not freeze. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([warmChannel(env), warmTierLists(env)]));
  },
};
