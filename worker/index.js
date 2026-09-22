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
const CACHE_VERSION = "2";

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
  return String(value ?? "").replace(/<c\d*>/gi, "").replace(/<\/c>/gi, "").trim();
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
      events.push({ kind: "join", playerTag: tag, playerName: member.name, roleFrom: null, roleTo: member.role });
    }
  }
  for (const [tag, member] of before) {
    if (!after.has(tag)) {
      events.push({ kind: "leave", playerTag: tag, playerName: member.name, roleFrom: member.role, roleTo: null });
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
        brawlerTrophies = Number.isFinite(player?.brawler?.trophies) ? player.brawler.trophies : null;
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
    mode: typeof event.mode === "string" ? event.mode : typeof battle.mode === "string" ? battle.mode : null,
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

/** Official leaderboard payload → a compact table for the Ladder tab. */
export function mapRanking(type, raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    type,
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
  const key = new Request(`${request.url}${request.url.includes("?") ? "&" : "?"}v=${CACHE_VERSION}`);
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
  const country = (url.searchParams.get("country") ?? "global").toLowerCase();
  return cached(request, ctx, META_TTL_SECONDS, async () => {
    try {
      const res = await upstream(env, `/rankings/${country}/${type}?limit=200`);
      if (!res.ok) return upstreamFailure(res.status, res.body);
      return json(mapRanking(type, JSON.parse(res.body)));
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
    upcoming: events.filter((event) => startsAt(event) > now).sort((a, b) => startsAt(a) - startsAt(b)),
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
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
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
    if (path === "/ladder") return handleLadder(request, env, ctx);
    if (path === "/maps") return handleMaps(request, env, ctx);

    const battles = /^\/battles\/([0-9A-Za-z]{3,16})$/.exec(path);
    if (battles) return handleBattles(request, env, ctx, battles[1]);

    const player = /^\/player\/([0-9A-Za-z]{3,16})$/.exec(path);
    if (player) return handlePlayer(request, env, ctx, player[1]);

    return json({ error: "not found" }, 404);
  },
};
